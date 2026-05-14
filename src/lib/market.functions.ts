import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooChart } from "./yahoo.server";
import {
  combine, detectBreakout, scoreFundamental, scoreMacro, scoreMonthly, scoreRS, scoreVolume, scoreWeekly,
  TOP_PICK_SWING_THRESHOLD,
} from "./agents.server";

// Load human-curated rules captured in agent_feedback (role='rule' or
// role='user') for a given agent. Returns text snippets the AI / scoring
// can consult.
async function loadAgentRules(agent: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("agent_feedback")
    .select("message, role")
    .eq("agent", agent)
    .in("role", ["rule", "user"])
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => r.message);
}

const CACHE_TTL_MS = 60 * 1000; // 1 min
const NIFTY = "^NSEI";

async function getBenchmark() {
  const r = await fetchYahooChart(NIFTY, "1y", "1d");
  return r?.candles ?? [];
}

type LibExample = {
  tags: string[];
  label: string;
  monthly_trend?: string;
  weekly_structure?: string;
  volume_behavior?: string;
  quality: number;
};

async function loadTrainingLibrary(): Promise<{ examples: LibExample[]; tagFreq: Record<string, number> }> {
  const { data } = await supabaseAdmin
    .from("training_examples")
    .select("label, tags, features");
  const tagFreq: Record<string, number> = {};
  const examples: LibExample[] = [];
  for (const row of data ?? []) {
    const f = (row.features ?? {}) as any;
    const tags = ((row.tags as string[] | null) ?? []).map((t) => t.toLowerCase());
    for (const t of tags) tagFreq[t] = (tagFreq[t] ?? 0) + 1;
    const labelTag = String(row.label).toLowerCase();
    tagFreq[labelTag] = (tagFreq[labelTag] ?? 0) + 1;
    examples.push({
      tags: Array.from(new Set([...tags, labelTag])),
      label: labelTag,
      monthly_trend: f.monthly_trend,
      weekly_structure: f.weekly_structure,
      volume_behavior: f.volume_behavior,
      quality: typeof f.quality === "number" ? f.quality : 60,
    });
  }
  return { examples, tagFreq };
}

function autoTags(monthly: number, weekly: number, volume: number, rs: number): string[] {
  const tags: string[] = [];
  if (monthly >= 70) tags.push("strong_uptrend");
  if (weekly >= 70) tags.push("tight_base", "weekly_consolidation");
  if (volume >= 70) tags.push("accumulation", "volume_surge");
  if (rs >= 65) tags.push("relative_strength");
  if (monthly >= 70 && weekly >= 65) tags.push("successful_breakout");
  return tags;
}

// Derive structural descriptors from numeric scores so we can compare against
// the vision-extracted features stored on each training example.
function deriveStructure(monthly: number, weekly: number, volume: number) {
  const monthly_trend = monthly >= 60 ? "up" : monthly <= 40 ? "down" : "sideways";
  const weekly_structure =
    weekly >= 70 ? "tight_base" : weekly >= 55 ? "loose_base" : monthly >= 60 ? "expansion" : "downtrend";
  const volume_behavior =
    volume >= 75 ? "climax" : volume >= 60 ? "accumulation" : volume <= 35 ? "dry_up" : "neutral";
  return { monthly_trend, weekly_structure, volume_behavior };
}

function patternMatchScore(
  symbolTags: string[],
  structure: { monthly_trend: string; weekly_structure: string; volume_behavior: string },
  lib: { examples: LibExample[] },
): number {
  if (lib.examples.length === 0) return 55;
  const symSet = new Set(symbolTags.map((t) => t.toLowerCase()));
  let bestScore = 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const ex of lib.examples) {
    let s = 0;
    const overlap = ex.tags.filter((t) => symSet.has(t)).length;
    const union = new Set([...ex.tags, ...symSet]).size || 1;
    s += (overlap / union) * 60;
    if (ex.monthly_trend && ex.monthly_trend === structure.monthly_trend) s += 14;
    if (ex.weekly_structure && ex.weekly_structure === structure.weekly_structure) s += 14;
    if (ex.volume_behavior && ex.volume_behavior === structure.volume_behavior) s += 12;
    const qWeight = Math.max(0.3, ex.quality / 100);
    weightedSum += s * qWeight;
    weightTotal += qWeight;
    if (s > bestScore) bestScore = s;
  }
  const avg = weightTotal ? weightedSum / weightTotal : 0;
  const blended = 0.65 * bestScore + 0.35 * avg;
  return Math.round(Math.max(20, Math.min(98, 25 + blended)));
}

export const getQuote = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }) => {
    const { symbol } = data;
    // Look up universe row
    const { data: u } = await supabaseAdmin.from("stock_universe").select("*").eq("symbol", symbol.toUpperCase()).maybeSingle();
    const yahooSymbol = u?.yahoo_symbol ?? `${symbol.toUpperCase()}.NS`;

    // Cache
    const { data: cached } = await supabaseAdmin.from("price_cache").select("*").eq("symbol", symbol.toUpperCase()).maybeSingle();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      return cached.payload as any;
    }

    const q = await fetchYahooChart(yahooSymbol, "1y", "1d");
    if (!q) throw new Error(`No data for ${symbol}`);

    const benchmark = await getBenchmark();
    const m = scoreMonthly(q.candles);
    const w = scoreWeekly(q.candles);
    const v = scoreVolume(q.candles);
    const r = scoreRS(q.candles, benchmark);
    const f = scoreFundamental(q);
    const macro = scoreMacro(benchmark);
    const tags = autoTags(m.score, w.score, v.score, r.score);
    const structure = deriveStructure(m.score, w.score, v.score);
    const lib = await loadTrainingLibrary();
    const history = patternMatchScore(tags, structure, lib);

    // Sector score: avg monthly+weekly of sector peers in latest run
    let sector = 60;
    if (u?.sector) {
      const { data: peers } = await supabaseAdmin
        .from("rankings").select("sector_score, monthly_score, weekly_score")
        .eq("sector", u.sector).order("created_at", { ascending: false }).limit(20);
      if (peers && peers.length) {
        sector = Math.round(peers.reduce((a, p) => a + (p.monthly_score + p.weekly_score) / 2, 0) / peers.length);
      }
    }

    const scores = combine({
      monthly: m.score, weekly: w.score, sector, history, fundamental: f.score, macro,
      rs: r.score, volume: v.score,
      reasoning: { monthly: m.reason, weekly: w.reason, volume: v.reason, rs: r.reason, fundamental: f.reason },
    } as any);

    const payload = {
      symbol: symbol.toUpperCase(),
      yahoo_symbol: yahooSymbol,
      name: u?.name ?? q.name ?? symbol,
      sector: u?.sector ?? "Unknown",
      ltp: q.ltp,
      prev_close: q.prevClose,
      change_pct: q.changePct,
      day_high: q.dayHigh,
      day_low: q.dayLow,
      fifty_two_high: q.fiftyTwoHigh,
      fifty_two_low: q.fiftyTwoLow,
      market_cap: q.marketCap,
      currency: q.currency ?? "INR",
      candles: q.candles.slice(-180), // 6mo for chart
      tags,
      scores,
    };

    await supabaseAdmin.from("price_cache").upsert({ symbol: symbol.toUpperCase(), payload, updated_at: new Date().toISOString() });
    return payload;
  });

export const runAgents = createServerFn({ method: "POST" })
  .inputValidator((d: { source?: string }) => d ?? {})
  .handler(async ({ data }) => {
    const { data: run } = await supabaseAdmin
      .from("agent_runs").insert({ source: data?.source ?? "manual", status: "running" })
      .select().single();
    if (!run) throw new Error("Failed to create run");

    try {
      const { data: universe } = await supabaseAdmin.from("stock_universe").select("*").eq("active", true);
      if (!universe) throw new Error("Empty universe");

      const benchmark = await getBenchmark();
      const macro = scoreMacro(benchmark);
      const lib = await loadTrainingLibrary();

      // First pass: per-symbol scores (no sector yet)
      const results: any[] = [];
      for (const u of universe) {
        const q = await fetchYahooChart(u.yahoo_symbol, "1y", "1d");
        if (!q) continue;
        const m = scoreMonthly(q.candles);
        const w = scoreWeekly(q.candles);
        const v = scoreVolume(q.candles);
        const r = scoreRS(q.candles, benchmark);
        const f = scoreFundamental(q);
        const tags = autoTags(m.score, w.score, v.score, r.score);
        const structure = deriveStructure(m.score, w.score, v.score);
        const history = patternMatchScore(tags, structure, lib);
        const breakout = detectBreakout(q.candles);
        results.push({ u, q, m, w, v, r, f, history, tags, breakout });
      }

      // Sector aggregates
      const sectorAvg: Record<string, number> = {};
      const sectorCount: Record<string, number> = {};
      for (const x of results) {
        const s = x.u.sector;
        sectorAvg[s] = (sectorAvg[s] ?? 0) + (x.m.score + x.w.score) / 2;
        sectorCount[s] = (sectorCount[s] ?? 0) + 1;
      }
      const sectorScore: Record<string, number> = {};
      for (const k of Object.keys(sectorAvg)) sectorScore[k] = Math.round(sectorAvg[k] / sectorCount[k]);

      const rows = results.map((x) => {
        const sector = sectorScore[x.u.sector] ?? 60;
        const s = combine({
          monthly: x.m.score, weekly: x.w.score, sector, history: x.history,
          fundamental: x.f.score, macro, rs: x.r.score, volume: x.v.score,
          reasoning: { monthly: x.m.reason, weekly: x.w.reason, volume: x.v.reason, rs: x.r.reason, fundamental: x.f.reason },
        } as any);
        return {
          run_id: run.id,
          symbol: x.u.symbol, name: x.u.name, sector: x.u.sector,
          ltp: x.q.ltp, change_pct: x.q.changePct,
          monthly_score: s.monthly, weekly_score: s.weekly, sector_score: s.sector,
          history_score: s.history, fundamental_score: s.fundamental, macro_score: s.macro,
          rs_score: s.rs, volume_score: s.volume, swing_score: s.swing,
          status: s.status, reasoning: s.reasoning,
        };
      });

      if (rows.length) await supabaseAdmin.from("rankings").insert(rows);

      // === Strong recommendations pipeline ===
      // 1a) Archive expired active recommendations (time-based)
      await supabaseAdmin
        .from("recommendations")
        .update({ status: "historical", archived_at: new Date().toISOString(), outcome: "expired" })
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());

      // 1b) Archive picks that have run more than +10% above their entry
      //     (breakout line) — too extended, no longer a clean entry.
      const breakoutBySymbol = new Map(results.map((x) => [x.u.symbol, x.breakout]));
      const { data: liveActive } = await supabaseAdmin
        .from("recommendations").select("id, symbol, entry_price, ltp")
        .eq("status", "active");
      const extendedIds: string[] = [];
      for (const row of liveActive ?? []) {
        const br = breakoutBySymbol.get(row.symbol);
        const ref = Number(row.entry_price ?? br?.breakout_price ?? 0);
        const r = results.find((x) => x.u.symbol === row.symbol);
        const last = r?.q?.ltp ?? Number(row.ltp ?? 0);
        if (ref > 0 && last > 0 && ((last - ref) / ref) * 100 > 10) extendedIds.push(row.id);
      }
      if (extendedIds.length) {
        await supabaseAdmin.from("recommendations")
          .update({ status: "historical", archived_at: new Date().toISOString(), outcome: "extended" })
          .in("id", extendedIds);
      }

      // 2) Pick top breakout candidates — must (a) match a training pattern,
      //    (b) have actually broken out of a base in the last ~3 weeks, and
      //    (c) still trade within +10% of the breakout line (initial breakout
      //    or pullback/retest). Anything extended >10% above the line is
      //    skipped — too late to enter.
      //    Macro and historical-pattern scores are EXCLUDED from selection
      //    (info-only) per user requirement.
      const candidates = results
        .map((x) => {
          const sector = sectorScore[x.u.sector] ?? 60;
          const s = combine({
            monthly: x.m.score, weekly: x.w.score, sector, history: x.history,
            fundamental: x.f.score, macro, rs: x.r.score, volume: x.v.score,
            reasoning: { monthly: x.m.reason, weekly: x.w.reason, volume: x.v.reason, rs: x.r.reason, fundamental: x.f.reason },
          } as any);
          // Composite quality (no macro, no history): swing + volume + weekly base
          const quality = s.swing * 0.7 + x.v.score * 0.2 + x.w.score * 0.1;
          return { x, s, quality };
        })
        .filter(({ s, x, quality }) =>
          x.breakout.in_window &&                  // within breakout → +10% zone
          x.breakout.bars_since <= 25 &&           // breakout is recent
          s.swing >= TOP_PICK_SWING_THRESHOLD &&   // 70+ swing
          x.m.score >= 60 &&                       // monthly trend up
          x.w.score >= 55 &&                       // some base structure
          x.v.score >= 55 &&                       // volume not drying badly
          quality >= 68 &&
          x.tags.length > 0,
        )
        .sort((a, b) => b.quality - a.quality)
        .slice(0, 5);

      // 3) Fetch currently-active symbols to avoid duplicates
      const { data: activeRows } = await supabaseAdmin
        .from("recommendations").select("symbol").eq("status", "active");
      const activeSet = new Set((activeRows ?? []).map((r) => r.symbol));

      const newPicks = candidates
        .filter(({ x }) => !activeSet.has(x.u.symbol))
        .map(({ x, s }) => ({
          symbol: x.u.symbol, name: x.u.name, sector: x.u.sector,
          ltp: x.q.ltp,
          // Entry = breakout line (price will revisit this on a retest)
          entry_price: Number(x.breakout.breakout_price.toFixed(2)),
          swing_score: s.swing, monthly_score: s.monthly, weekly_score: s.weekly,
          history_score: s.history, volume_score: s.volume, rs_score: s.rs,
          tags: x.tags,
          reasoning: {
            ...s.reasoning,
            breakout: `Broke out ${x.breakout.bars_since}d ago from ₹${x.breakout.breakout_price.toFixed(2)}; now ${x.breakout.pct_above >= 0 ? "+" : ""}${x.breakout.pct_above.toFixed(1)}% above.`,
          },
          status: "active",
        }));
      if (newPicks.length) await supabaseAdmin.from("recommendations").insert(newPicks);

      await supabaseAdmin.from("agent_runs").update({
        finished_at: new Date().toISOString(), status: "success",
        scanned: universe.length, ranked: rows.length,
      }).eq("id", run.id);

      return { run_id: run.id, scanned: universe.length, ranked: rows.length, new_picks: newPicks.length };
    } catch (e: any) {
      console.error("[runAgents]", e);
      await supabaseAdmin.from("agent_runs").update({
        finished_at: new Date().toISOString(), status: "error", error: String(e?.message ?? e),
      }).eq("id", run.id);
      throw e;
    }
  });

export const getLatestRankings = createServerFn({ method: "GET" }).handler(async () => {
  const { data: lastRun } = await supabaseAdmin
    .from("agent_runs").select("*").eq("status", "success")
    .order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (!lastRun) return { run: null, rankings: [] as any[] };
  const { data: rankings } = await supabaseAdmin
    .from("rankings").select("*").eq("run_id", lastRun.id)
    .order("swing_score", { ascending: false });
  return { run: lastRun, rankings: rankings ?? [] };
});

export const searchUniverse = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return [] as any[];
    const { data: rows } = await supabaseAdmin
      .from("stock_universe").select("symbol, name, sector")
      .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`).limit(10);
    return rows ?? [];
  });

export const getRecommendations = createServerFn({ method: "GET" }).handler(async () => {
  // Auto-archive expired before reading
  await supabaseAdmin
    .from("recommendations")
    .update({ status: "historical", archived_at: new Date().toISOString(), outcome: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  const { data: active } = await supabaseAdmin
    .from("recommendations").select("*").eq("status", "active")
    .order("swing_score", { ascending: false }).limit(5);
  const { data: history } = await supabaseAdmin
    .from("recommendations").select("*").eq("status", "historical")
    .order("archived_at", { ascending: false }).limit(50);
  return { active: active ?? [], history: history ?? [] };
});

export const TOP_PICK_THRESHOLD = TOP_PICK_SWING_THRESHOLD;

// User removes a pick → archive with reason + optional uploaded chart.
// The screenshot becomes a 'failed_breakout' training example so the AI
// doesn't repeat the same mistake.
export const removePick = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; reason: string; image_path?: string }) => d)
  .handler(async ({ data }) => {
    const { data: rec } = await supabaseAdmin
      .from("recommendations").select("*").eq("id", data.id).single();
    if (!rec) throw new Error("not found");

    await supabaseAdmin.from("recommendations").update({
      status: "historical",
      archived_at: new Date().toISOString(),
      outcome: "user_removed",
      removed_reason: data.reason,
      removed_image_path: data.image_path ?? null,
    }).eq("id", data.id);

    if (data.image_path) {
      await supabaseAdmin.from("training_examples").insert({
        image_path: data.image_path,
        label: "failed_breakout",
        symbol: rec.symbol, sector: rec.sector,
        note: `User removed pick · reason: ${data.reason}`,
      });
    }
    await supabaseAdmin.from("agent_feedback").insert({
      agent: "weekly_consolidation",
      role: "rule",
      message: `Avoid lookalikes of ${rec.symbol} (${rec.sector}). Reason: ${data.reason}`,
      context: { symbol: rec.symbol, sector: rec.sector, swing_score: rec.swing_score },
    });
    return { ok: true };
  });

export const getAgentChat = createServerFn({ method: "GET" })
  .inputValidator((d: { agent: string }) => d)
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("agent_feedback").select("*")
      .eq("agent", data.agent)
      .order("created_at", { ascending: true })
      .limit(100);
    return rows ?? [];
  });

export const sendAgentChat = createServerFn({ method: "POST" })
  .inputValidator((d: { agent: string; message: string }) => d)
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    await supabaseAdmin.from("agent_feedback").insert({
      agent: data.agent, role: "user", message: data.message,
    });

    const { data: history } = await supabaseAdmin
      .from("agent_feedback").select("role, message")
      .eq("agent", data.agent)
      .order("created_at", { ascending: true })
      .limit(40);

    const agentDescriptions: Record<string, string> = {
      data: "live market data ingestion (NSE/BSE OHLCV, delivery %, freshness)",
      sector: "sector sync — detect when ≥40% of a sector's members are basing while the sector trend remains bullish",
      monthly: "monthly trend strength — higher highs/lows, EMA50/200 stack, 6-month return",
      weekly: "weekly consolidation — multi-month tight bases, range tightness, breakout proximity",
      weekly_consolidation: "weekly consolidation — multi-month tight bases, range tightness, breakout proximity",
      history: "historical pattern matching against the user-curated training library",
      fundamental: "fundamental quality — ROCE, earnings momentum, distance from 52-week high",
      macro: "macro / news regime — Nifty trend, sector tailwinds, policy signals",
      master: "master conviction — weighted ensemble of all upstream agents",
    };
    const desc = agentDescriptions[data.agent] ?? data.agent.replace(/_/g, " ");
    const system = `You are the "${data.agent.replace(/_/g, " ")}" agent for an Indian-equities swing-trading AI.
Specialty: ${desc}.
The user is teaching you. Listen carefully to mistakes (e.g. "you missed ADANIPORTS — long flat base, breakout at 1600").
Reply concisely (max 6 lines): (1) what you understood, (2) the new rule you'll apply, (3) one concrete heuristic / threshold change.
End with a single line:
RULE: <one-line rule the scoring engine should remember>`;

    const messages = [
      { role: "system", content: system },
      ...(history ?? [])
        .filter((h) => h.role === "user" || h.role === "assistant")
        .map((h) => ({ role: h.role, content: h.message })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "(no reply)";

    await supabaseAdmin.from("agent_feedback").insert({
      agent: data.agent, role: "assistant", message: reply,
    });
    const ruleMatch = reply.match(/RULE:\s*(.+)/i);
    if (ruleMatch) {
      await supabaseAdmin.from("agent_feedback").insert({
        agent: data.agent, role: "rule", message: ruleMatch[1].trim(),
      });
    }
    return { reply };
  });

export const getCategoryStocks = createServerFn({ method: "GET" })
  .inputValidator((d: { category: "bullish_monthly" | "weekly_consolidation" | "synced_sector" | "high_conviction" }) => d)
  .handler(async ({ data }) => {
    const { data: lastRun } = await supabaseAdmin
      .from("agent_runs").select("*").eq("status", "success")
      .order("finished_at", { ascending: false }).limit(1).maybeSingle();
    if (!lastRun) return [] as any[];
    let query = supabaseAdmin.from("rankings").select("*").eq("run_id", lastRun.id);
    if (data.category === "bullish_monthly")      query = query.gte("monthly_score", 65);
    if (data.category === "weekly_consolidation") query = query.gte("weekly_score", 70);
    if (data.category === "synced_sector")        query = query.gte("sector_score", 70);
    if (data.category === "high_conviction")      query = query.gte("swing_score", TOP_PICK_SWING_THRESHOLD);
    const { data: rows } = await query.order("swing_score", { ascending: false }).limit(50);
    return rows ?? [];
  });
