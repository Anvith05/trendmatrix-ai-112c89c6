// 8-agent scoring engine. Pure functions on candles.
import { type Candle, type YahooQuote, ema, sma, rsi, pctChange, tightness, clamp } from "./yahoo.server";

export type AgentScores = {
  monthly: number;       // long-term trend strength
  weekly: number;        // base tightness / consolidation
  sector: number;        // injected later (sector sync)
  history: number;       // training-pattern match (injected)
  fundamental: number;   // basic quality proxy
  macro: number;         // injected (Nifty regime)
  rs: number;            // relative strength vs benchmark
  volume: number;        // accumulation
  swing: number;         // weighted master score
  status: "breaking_out" | "basing" | "watch";
  reasoning: Record<string, string>;
};

export const AGENT_WEIGHTS = {
  monthly: 0.20,
  weekly: 0.18,
  sector: 0.14,
  history: 0.12,
  fundamental: 0.08,
  macro: 0.06,
  rs: 0.12,
  volume: 0.10,
};

export function scoreMonthly(candles: Candle[]): { score: number; reason: string } {
  const closes = candles.map((c) => c.c);
  if (closes.length < 60) return { score: 30, reason: "insufficient history" };
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const last = closes[closes.length - 1];
  const slope200 = e200.length > 40 ? (e200[e200.length - 1] - e200[e200.length - 40]) / e200[e200.length - 40] : 0;
  const ret6m = pctChange(closes, Math.min(126, closes.length - 1));
  const above50 = last > e50[e50.length - 1] ? 1 : 0;
  const above200 = last > (e200[e200.length - 1] || 0) ? 1 : 0;
  const score = clamp(40 + ret6m * 1.2 + slope200 * 200 + above50 * 8 + above200 * 12);
  return { score: Math.round(score), reason: `6m ${ret6m.toFixed(1)}%, EMA200 slope ${(slope200 * 100).toFixed(1)}%` };
}

export function scoreWeekly(candles: Candle[]): { score: number; reason: string } {
  const closes = candles.map((c) => c.c);
  if (closes.length < 50) return { score: 30, reason: "insufficient" };
  const tight = tightness(closes, 40);            // ~0.02 = very tight, 0.10 = wide
  const ret1m = pctChange(closes, 21);
  // Reward tight base + non-extended (-3% to +6% over month)
  const tightScore = clamp(100 - tight * 900);
  const baseFlat = ret1m > -3 && ret1m < 6 ? 12 : 0;
  return { score: Math.round(clamp(tightScore * 0.85 + baseFlat + 8)), reason: `tightness ${(tight * 100).toFixed(1)}%, 1m ${ret1m.toFixed(1)}%` };
}

export function scoreVolume(candles: Candle[]): { score: number; reason: string } {
  if (candles.length < 60) return { score: 40, reason: "insufficient" };
  const vols = candles.map((c) => c.v);
  const closes = candles.map((c) => c.c);
  const last10 = vols.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const last50 = vols.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const ratio = last50 ? last10 / last50 : 1;
  // Up-day vs down-day volume bias (last 20)
  let upV = 0, dnV = 0;
  for (let i = candles.length - 20; i < candles.length; i++) {
    if (i <= 0) continue;
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) upV += vols[i]; else dnV += vols[i];
  }
  const bias = upV + dnV ? upV / (upV + dnV) : 0.5;
  const score = clamp(35 + (ratio - 1) * 60 + (bias - 0.5) * 80);
  return { score: Math.round(score), reason: `vol 10/50 ${ratio.toFixed(2)}, up-vol ${(bias * 100).toFixed(0)}%` };
}

export function scoreRS(candles: Candle[], benchmark: Candle[]): { score: number; reason: string } {
  if (candles.length < 60 || benchmark.length < 60) return { score: 50, reason: "no benchmark" };
  const cR = pctChange(candles.map((c) => c.c), 60);
  const bR = pctChange(benchmark.map((c) => c.c), 60);
  const diff = cR - bR;
  return { score: Math.round(clamp(50 + diff * 1.8)), reason: `vs Nifty 60d: ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` };
}

export function scoreFundamental(q: YahooQuote): { score: number; reason: string } {
  // Proxy: distance from 52w high (closer = stronger), market cap tier, RSI healthy zone
  const closes = q.candles.map((c) => c.c);
  const r = rsi(closes, 14);
  const distHigh = q.fiftyTwoHigh ? (q.ltp / q.fiftyTwoHigh) * 100 : 80;
  const capTier = q.marketCap && q.marketCap > 1e10 ? 10 : 0;
  const rsiBand = r > 45 && r < 75 ? 12 : 0;
  return { score: Math.round(clamp(35 + (distHigh - 60) * 0.8 + capTier + rsiBand)), reason: `${distHigh.toFixed(0)}% of 52w hi, RSI ${r.toFixed(0)}` };
}

export function combine(s: Omit<AgentScores, "swing" | "status">): AgentScores {
  const w = AGENT_WEIGHTS;
  const swing = Math.round(
    s.monthly * w.monthly +
    s.weekly * w.weekly +
    s.sector * w.sector +
    s.history * w.history +
    s.fundamental * w.fundamental +
    s.macro * w.macro +
    s.rs * w.rs +
    s.volume * w.volume,
  );
  const status: AgentScores["status"] = swing >= 78 ? "breaking_out" : swing >= 62 ? "basing" : "watch";
  return { ...s, swing, status };
}

// Detect a recent breakout from a consolidation base.
// Returns the breakout reference price (prior range high), whether price is
// currently within +10% of it (entry window), how far above (pct), and whether
// a breakout actually happened in the last `recent` bars.
export function detectBreakout(candles: Candle[], lookback = 40, recent = 15): {
  breakout_price: number;
  pct_above: number;
  in_window: boolean;
  broke_out: boolean;
  bars_since: number;
} {
  if (candles.length < lookback + recent + 5) {
    return { breakout_price: 0, pct_above: 0, in_window: false, broke_out: false, bars_since: -1 };
  }
  // Reference range = highs from (len - recent - lookback) to (len - recent)
  const baseStart = candles.length - recent - lookback;
  const baseEnd = candles.length - recent;
  let baseHigh = 0;
  for (let i = baseStart; i < baseEnd; i++) baseHigh = Math.max(baseHigh, candles[i].h);
  // First bar in the recent window whose close pierced baseHigh
  let bars_since = -1;
  for (let i = baseEnd; i < candles.length; i++) {
    if (candles[i].c > baseHigh) { bars_since = candles.length - 1 - i; break; }
  }
  const last = candles[candles.length - 1].c;
  const pct_above = baseHigh ? ((last - baseHigh) / baseHigh) * 100 : 0;
  const broke_out = bars_since >= 0;
  // Entry window: price is currently between breakout line and +10% (covers
  // initial breakout AND retests that pull back into the zone).
  const in_window = broke_out && pct_above >= -1 && pct_above <= 10;
  return { breakout_price: baseHigh, pct_above, in_window, broke_out, bars_since };
}

export function scoreMacro(benchmark: Candle[]): number {
  if (benchmark.length < 60) return 60;
  const closes = benchmark.map((c) => c.c);
  const e50 = ema(closes, 50);
  const last = closes[closes.length - 1];
  const above = last > e50[e50.length - 1] ? 15 : -10;
  const ret = pctChange(closes, 30);
  return Math.round(clamp(55 + ret * 2 + above));
}
