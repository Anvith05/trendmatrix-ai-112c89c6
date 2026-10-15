import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeRiskScore, regimeFromScore, type MacroIndicator, type Regime } from "./macro";

const CACHE_KEY = "__MACRO_REGIME__";
const TTL_MS = 30 * 60 * 1000;

const FEEDS: { key: string; label: string; y: string }[] = [
  { key: "nifty", label: "Nifty 50", y: "^NSEI" },
  { key: "banknifty", label: "Bank Nifty", y: "^NSEBANK" },
  { key: "vix", label: "India VIX", y: "^INDIAVIX" },
  { key: "crude", label: "Brent Crude", y: "BZ=F" },
  { key: "dxy", label: "Dollar Index", y: "DX-Y.NYB" },
  { key: "us10y", label: "US 10Y Yield", y: "^TNX" },
  { key: "us2y", label: "US 2Y Yield", y: "2YY=F" },
  { key: "copper", label: "Copper", y: "HG=F" },
  { key: "spx", label: "S&P 500", y: "^GSPC" },
  { key: "usdinr", label: "USD/INR", y: "INR=X" },
  { key: "gold", label: "Gold BeES", y: "GOLDBEES.NS" },
  { key: "pharma", label: "Nifty Pharma", y: "^CNXPHARMA" },
  { key: "fmcg", label: "Nifty FMCG", y: "^CNXFMCG" },
];

export type MacroReport = {
  updated_at: string; yield_curve?: number | null; risk_score: number; regime: Regime; flags: string[];
  indicators: MacroIndicator[];
  ai: null | { headline: string; briefing: string; playbook: string[]; crash_opportunities: string[]; defensive_rotation: string[]; outlook_3_6m: string };
};

async function build(): Promise<MacroReport> {
  const { fetchYahooChart } = await import("./yahoo.server");
  const res = await Promise.all(FEEDS.map(async (f) => {
    const q = await fetchYahooChart(f.y, "6mo", "1d");
    if (!q || q.candles.length < 25) return { key: f.key, label: f.label, value: null, chg1m: null, aboveSma50: null };
    const c = q.candles.map((x) => x.c);
    const last = c[c.length - 1]; const m1 = c[Math.max(0, c.length - 22)];
    const w = c.slice(-50); const sma50 = w.reduce((a, b) => a + b, 0) / w.length;
    return { key: f.key, label: f.label, value: last, chg1m: ((last - m1) / m1) * 100, aboveSma50: last > sma50 };
  }));
  const map = Object.fromEntries(res.map((r) => [r.key, r]));
  const yc = map.us10y?.value != null && map.us2y?.value != null ? map.us10y.value - map.us2y.value : null;
  const { score, flags } = computeRiskScore(map, yc);
  const regime = regimeFromScore(score);
  let ai: MacroReport["ai"] = null;
  try {
    const { callAgentJSON } = await import("./deliberation.server");
    const arr = { type: "array", items: { type: "string" } };
    ai = await callAgentJSON(
      "You are the Macro Sentinel for an Indian NSE/BSE cash-market swing trader (long-only, no F&O, no foreign stocks). Global data is context only. Use only the numbers given; never invent data. Give practical ways to protect capital and make money in Indian stocks/ETFs in every regime: in crashes, quality oversold bounces at support; defensive rotation (Pharma, FMCG, GOLDBEES, LIQUIDBEES); cash sizing; trailing stops. Be honest that crashes cannot be predicted with certainty.",
      `US 10Y-2Y spread: ${yc?.toFixed(2) ?? "n/a"}. Rule-based risk score: ${score}/100, regime: ${regime}. Flags: ${flags.join("; ") || "none"}.\nIndicators (value, 1-month % change, above 50DMA):\n${res.map((r) => `${r.label}: ${r.value?.toFixed(2) ?? "n/a"}, ${r.chg1m?.toFixed(2) ?? "n/a"}%, ${r.aboveSma50}`).join("\n")}`,
      { type: "object", additionalProperties: false, required: ["headline", "briefing", "playbook", "crash_opportunities", "defensive_rotation", "outlook_3_6m"],
        properties: { headline: { type: "string" }, briefing: { type: "string" }, playbook: arr, crash_opportunities: arr, defensive_rotation: arr, outlook_3_6m: { type: "string" } } },
      "macro_sentinel",
    );
  } catch (e) { console.error("[macro] AI failed", e); }
  return { updated_at: new Date().toISOString(), yield_curve: yc, risk_score: score, regime, flags, indicators: res, ai };
}

export const getMacroRegime = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("price_cache").select("payload, updated_at").eq("symbol", CACHE_KEY).maybeSingle();
    if (c && !data.force && Date.now() - new Date(c.updated_at).getTime() < TTL_MS) return c.payload as unknown as MacroReport;
    const report = await build();
    await supabaseAdmin.from("price_cache").upsert({ symbol: CACHE_KEY, payload: report as any, updated_at: report.updated_at });
    return report;
  });

// ---- Live universe scan (cached 30 min) shared by Crash Shopping + Undervalued Rebounds ----
type ScanRow = { symbol: string; name: string; sector: string; ltp: number; hi: number; drawdown: number;
  ret20: number; above20: boolean; above50: boolean; turnoverCr: number; fallDayAvg: number | null; reboundAvg: number | null; ret1y: number };

const SCAN_KEY = "__UNIVERSE_SCAN__";
async function scanUniverse(): Promise<ScanRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: c } = await supabaseAdmin.from("price_cache").select("payload, updated_at").eq("symbol", SCAN_KEY).maybeSingle();
  if (c && Date.now() - new Date(c.updated_at).getTime() < TTL_MS) return c.payload as unknown as ScanRow[];
  const { fetchYahooChart } = await import("./yahoo.server");
  const { data: uni } = await supabaseAdmin.from("stock_universe").select("symbol, yahoo_symbol, name, sector, kind").eq("active", true);
  const nifty = await fetchYahooChart("^NSEI", "1y", "1d").catch(() => null);
  const nRet = new Map<number, number>();
  (nifty?.candles ?? []).forEach((k, i, a) => { if (i) nRet.set(Math.floor(k.t / 86400), (k.c - a[i - 1].c) / a[i - 1].c * 100); });
  const rows: ScanRow[] = [];
  await Promise.all((uni ?? []).filter((u) => u.kind === "stock").map(async (u) => {
    const q = await fetchYahooChart(u.yahoo_symbol, "1y", "1d").catch(() => null);
    const k = q?.candles ?? []; if (k.length < 120) return;
    const cl = k.map((x) => x.c); const ltp = cl[cl.length - 1];
    const hi = Math.max(...k.map((x) => x.h));
    const sma = (n: number) => cl.slice(-n).reduce((a, b) => a + b, 0) / n;
    const turnover = k.slice(-20).reduce((a, x) => a + x.c * ((x as any).v ?? 0), 0) / 20 / 1e7;
    const fall: number[] = [], reb: number[] = [];
    k.forEach((x, i) => { if (!i) return; const nr = nRet.get(Math.floor(x.t / 86400)); if (nr == null) return;
      const r = (x.c - k[i - 1].c) / k[i - 1].c * 100;
      if (nr <= -1) fall.push(r - nr); // outperformance vs Nifty on fall days
      if (nr >= 1) reb.push(r - nr); });
    const avg = (a: number[]) => a.length >= 3 ? a.reduce((s, v) => s + v, 0) / a.length : null;
    rows.push({ symbol: u.symbol, name: u.name, sector: u.sector, ltp, hi, drawdown: (ltp - hi) / hi * 100,
      ret20: (ltp - cl[cl.length - 21]) / cl[cl.length - 21] * 100, above20: ltp > sma(20), above50: ltp > sma(50),
      turnoverCr: turnover, fallDayAvg: avg(fall), reboundAvg: avg(reb), ret1y: (ltp - cl[0]) / cl[0] * 100 });
  }));
  await supabaseAdmin.from("price_cache").upsert({ symbol: SCAN_KEY, payload: rows as any, updated_at: new Date().toISOString() });
  return rows;
}

export type WatchItem = { symbol: string; name: string; why: string; ltp: number | null; drawdown: number | null; zone: "deep_value" | "buy_zone" | "wait" | "n/a" };

/** Live: top 4 liquid stocks that hold up best on Nifty fall days and bounce hardest on up days. */
export const getCrashWatchlist = createServerFn({ method: "POST" }).handler(async (): Promise<WatchItem[]> => {
  const rows = (await scanUniverse()).filter((r) => r.fallDayAvg != null && r.reboundAvg != null && r.turnoverCr >= 10);
  return rows.map((r) => ({ r, s: r.fallDayAvg! * 1.5 + r.reboundAvg! + (r.above50 ? 0.3 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 4).map(({ r }) => ({
      symbol: r.symbol, name: r.name, ltp: r.ltp, drawdown: r.drawdown,
      why: `${r.sector} · beats Nifty by ${r.fallDayAvg!.toFixed(2)}%/day on fall days, ${r.reboundAvg! >= 0 ? "+" : ""}${r.reboundAvg!.toFixed(2)}% on rebound days`,
      zone: r.drawdown <= -25 ? "deep_value" : r.drawdown <= -12 ? "buy_zone" : "wait",
    }));
});

export type ValuePick = { symbol: string; name: string; sector: string; ltp: number; drawdown: number; ret20: number; turnoverCr: number; score: number; why: string };

/** Live: quality liquid stocks 18-55% off their 1y high that are regaining momentum. Independent of Top Picks/Journal. */
export const getUndervaluedRebounds = createServerFn({ method: "POST" }).handler(async (): Promise<ValuePick[]> => {
  const rows = (await scanUniverse()).filter((r) => r.drawdown <= -18 && r.drawdown >= -55 && r.above20 && r.ret20 > 0 && r.turnoverCr >= 10);
  return rows.map((r) => {
    const score = Math.round(Math.min(100, Math.abs(r.drawdown) * 1.2 + Math.min(r.ret20, 15) * 2 + (r.above50 ? 15 : 0) + Math.min(r.turnoverCr / 10, 10)));
    return { symbol: r.symbol, name: r.name, sector: r.sector, ltp: r.ltp, drawdown: r.drawdown, ret20: r.ret20, turnoverCr: r.turnoverCr, score,
      why: `${Math.abs(r.drawdown).toFixed(0)}% below 1y high, +${r.ret20.toFixed(1)}% in 20 days${r.above50 ? ", back above 50-day avg" : ""}. Upside to old high: +${((r.hi / r.ltp - 1) * 100).toFixed(0)}%` };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
});
