// Yahoo Finance fetcher + technical indicators. Server-only.
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type YahooQuote = {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  ltp: number;
  prevClose: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoHigh?: number;
  fiftyTwoLow?: number;
  marketCap?: number;
  candles: Candle[];
};

const UA = "Mozilla/5.0 (compatible; TrendMatrixAI/1.0)";

export async function fetchYahooChart(yahooSymbol: string, range = "1y", interval = "1d"): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const json: any = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const ts: number[] = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};
    const candles: Candle[] = ts.map((t, i) => ({
      t: t * 1000,
      o: q.open?.[i],
      h: q.high?.[i],
      l: q.low?.[i],
      c: q.close?.[i],
      v: q.volume?.[i] ?? 0,
    })).filter((c) => Number.isFinite(c.c));
    const last = candles[candles.length - 1];
    if (!last) return null;
    const ltp = meta.regularMarketPrice ?? last.c;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? candles[candles.length - 2]?.c ?? ltp;
    return {
      symbol: meta.symbol ?? yahooSymbol,
      name: meta.longName ?? meta.shortName,
      exchange: meta.exchangeName,
      currency: meta.currency,
      ltp,
      prevClose: prev,
      changePct: prev ? ((ltp - prev) / prev) * 100 : 0,
      dayHigh: meta.regularMarketDayHigh ?? last.h,
      dayLow: meta.regularMarketDayLow ?? last.l,
      fiftyTwoHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoLow: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
      candles,
    };
  } catch (e) {
    console.error("[yahoo] fetch failed", yahooSymbol, e);
    return null;
  }
}

// ---------- Indicators ----------
export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

export function pctChange(values: number[], lookback: number): number {
  if (values.length <= lookback) return 0;
  const a = values[values.length - 1 - lookback];
  const b = values[values.length - 1];
  return a ? ((b - a) / a) * 100 : 0;
}

// Tightness: stddev of last N closes / mean (lower = tighter base)
export function tightness(values: number[], n = 40): number {
  if (values.length < n) return 0;
  const slice = values.slice(-n);
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const v = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.sqrt(v) / mean;
}

export function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}
