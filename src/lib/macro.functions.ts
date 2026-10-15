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
