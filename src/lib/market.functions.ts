import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooChart } from "./yahoo.server";
import {
  combine, scoreFundamental, scoreMacro, scoreMonthly, scoreRS, scoreVolume, scoreWeekly,
} from "./agents.server";

const CACHE_TTL_MS = 60 * 1000; // 1 min
const NIFTY = "^NSEI";

async function getBenchmark() {
  const r = await fetchYahooChart(NIFTY, "1y", "1d");
  return r?.candles ?? [];
}

async function loadTrainingTags() {
  const { data } = await supabaseAdmin.from("training_examples").select("label, tags");
  const tagFreq: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const t of (row.tags as string[] | null) ?? []) {
      tagFreq[t.toLowerCase()] = (tagFreq[t.toLowerCase()] ?? 0) + 1;
    }
    tagFreq[row.label.toLowerCase()] = (tagFreq[row.label.toLowerCase()] ?? 0) + 1;
  }
  return tagFreq;
}

function patternMatchScore(symbolTags: string[], libraryFreq: Record<string, number>): number {
  if (Object.keys(libraryFreq).length === 0) return 55;
  let matched = 0, total = 0;
  for (const t of symbolTags) {
    total += 1;
    if (libraryFreq[t.toLowerCase()]) matched += 1 + Math.log(libraryFreq[t.toLowerCase()]);
  }
  return Math.round(Math.max(20, Math.min(95, 40 + matched * 12)));
}

// Cheap auto-tagger from candles, used when we don't have a chart image embedding.
function autoTags(monthly: number, weekly: number, volume: number, rs: number): string[] {
  const tags: string[] = [];
  if (monthly >= 70) tags.push("strong_uptrend");
  if (weekly >= 70) tags.push("tight_base", "weekly_consolidation");
  if (volume >= 70) tags.push("accumulation", "volume_surge");
  if (rs >= 65) tags.push("relative_strength");
  if (monthly >= 70 && weekly >= 65) tags.push("successful_breakout");
  return tags;
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
    const lib = await loadTrainingTags();
    const history = patternMatchScore(tags, lib);

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
      const lib = await loadTrainingTags();

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
        const history = patternMatchScore(tags, lib);
        results.push({ u, q, m, w, v, r, f, history, tags });
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
      await supabaseAdmin.from("agent_runs").update({
        finished_at: new Date().toISOString(), status: "success",
        scanned: universe.length, ranked: rows.length,
      }).eq("id", run.id);

      return { run_id: run.id, scanned: universe.length, ranked: rows.length };
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
