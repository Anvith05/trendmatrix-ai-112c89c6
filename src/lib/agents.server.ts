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

// Master swing weights — macro & history are computed for context but
// EXCLUDED from the conviction score (user requirement: macro = info-only,
// history = info-only). Weights re-normalised to sum to 1.0.
export const AGENT_WEIGHTS = {
  monthly: 0.25,
  weekly: 0.22,
  sector: 0.18,
  history: 0.00,   // info-only — not included in swing
  fundamental: 0.10,
  macro: 0.00,     // info-only — not included in swing
  rs: 0.15,
  volume: 0.10,
};
// Score threshold above which a stock is considered a "top pick" candidate.
export const TOP_PICK_SWING_THRESHOLD = 70;

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

// Multi-window weekly-consolidation detector.
//
// Old detector only looked at the last ~40 trading days, so multi-month bases
// (e.g. ADANIPORTS 1300–1600 over 18 months with a clean breakout) scored
// almost nothing. New version sweeps several lookbacks (≈3M, 6M, 9M, 12M),
// finds the best base, and rewards:
//   • tight range relative to mid price
//   • base length (longer = higher conviction)
//   • price now near the upper edge / fresh breakout
//   • shallow drawdown from the base high
export function scoreWeekly(candles: Candle[]): { score: number; reason: string } {
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  if (closes.length < 60) return { score: 30, reason: "insufficient history" };

  const last = closes[closes.length - 1];
  const windows = [60, 120, 180, 240].filter((n) => n <= closes.length);

  let best = { score: 25, reason: "no clean base" };
  for (const n of windows) {
    const sliceH = highs.slice(-n);
    const sliceL = lows.slice(-n);
    const sliceC = closes.slice(-n);
    const hi = Math.max(...sliceH);
    const lo = Math.min(...sliceL);
    const mid = (hi + lo) / 2;
    if (!mid) continue;
    const rangePct = ((hi - lo) / mid) * 100;
    // Reject windows that are wild swings (>40%): not a base.
    if (rangePct > 40) continue;

    // Tightness component: 0% range → 40 pts, 40% range → 0 pts.
    const tightPts = Math.max(0, 40 - rangePct);
    // Length component: longer base = up to 25 pts (caps at 240 bars).
    const lengthPts = Math.min(25, (n / 240) * 25);
    // Position component: where in the range is price NOW (0 = at low, 1 = at high)
    const pos = (last - lo) / Math.max(0.0001, hi - lo);
    const positionPts = Math.max(0, Math.min(25, pos * 25));
    // Pullback inside the base: how often closes stayed inside the band
    const inside = sliceC.filter((c) => c <= hi * 1.02 && c >= lo * 0.98).length;
    const stabilityPts = (inside / n) * 10;

    const score = Math.round(clamp(15 + tightPts + lengthPts + positionPts + stabilityPts));
    if (score > best.score) {
      best = {
        score,
        reason: `${n}d base · range ${rangePct.toFixed(1)}% · price ${(pos * 100).toFixed(0)}% up the range`,
      };
    }
  }
  return best;
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
  // Quality proxy built only from data Yahoo's free chart feed actually returns:
  // distance from 52w high, liquidity (avg daily traded value) and RSI health.
  // (Market cap is NOT available from the free feed, so it is not used.)
  const closes = q.candles.map((c) => c.c);
  const r = rsi(closes, 14);
  const distHigh = q.fiftyTwoHigh ? (q.ltp / q.fiftyTwoHigh) * 100 : 80;
  const last20 = q.candles.slice(-20);
  const avgValueCr = last20.length
    ? last20.reduce((a, c) => a + c.c * (c.v || 0), 0) / last20.length / 1e7
    : 0;
  const liquidityPts = avgValueCr >= 50 ? 10 : avgValueCr >= 10 ? 5 : 0;
  const rsiBand = r > 45 && r < 75 ? 12 : 0;
  const score = Math.round(clamp(35 + (distHigh - 60) * 0.8 + liquidityPts + rsiBand));
  return {
    score,
    reason: `35 + (${distHigh.toFixed(0)}%of52wHi−60)×0.8 + liquidity ${liquidityPts} (₹${avgValueCr.toFixed(0)}Cr/day) + RSI ${r.toFixed(0)} band ${rsiBand} = ${score}`,
  };
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
