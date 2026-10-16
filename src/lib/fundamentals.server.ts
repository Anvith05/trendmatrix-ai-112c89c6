// Real company financials from Yahoo's free fundamentals-timeseries feed
// (annual reports: profit, revenue, equity, debt, EPS + trailing P/E).
// Cached 7 days per symbol in price_cache under "__FUND__:<SYMBOL>".
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Fundamentals = {
  score: number; // 0-100 business quality + valuation
  reason: string;
  pe: number | null; roe: number | null; debtToEquity: number | null;
  profitGrowth: number | null; revenueGrowth: number | null; profitable: boolean;
  asOf: string | null;
};

const TYPES = ["annualNetIncome", "annualTotalRevenue", "annualStockholdersEquity", "annualTotalDebt", "trailingPeRatio"];

function series(json: any, type: string): { date: string; v: number }[] {
  const r = (json?.timeseries?.result ?? []).find((x: any) => x?.meta?.type?.[0] === type);
  return ((r?.[type] ?? []) as any[]).filter((p) => p?.reportedValue?.raw != null)
    .map((p) => ({ date: p.asOfDate, v: Number(p.reportedValue.raw) }));
}

export function scoreFundamentals(json: any): Fundamentals | null {
  const ni = series(json, "annualNetIncome");
  const rev = series(json, "annualTotalRevenue");
  const eq = series(json, "annualStockholdersEquity");
  const debt = series(json, "annualTotalDebt");
  const peS = series(json, "trailingPeRatio");
  if (!ni.length || !rev.length) return null;
  const last = (a: { v: number }[]) => a.at(-1)?.v ?? null;
  const growth = (a: { v: number }[]) => a.length >= 2 && a[a.length - 2].v > 0 ? ((a[a.length - 1].v / a[a.length - 2].v) - 1) * 100 : null;
  const niL = last(ni)!, eqL = last(eq), debtL = last(debt), pe = last(peS);
  const roe = eqL && eqL > 0 ? (niL / eqL) * 100 : null;
  const de = eqL && eqL > 0 && debtL != null ? debtL / eqL : null;
  const pg = growth(ni), rg = growth(rev);
  let s = 30; const why: string[] = [];
  if (niL > 0) { s += 10; why.push("profitable"); } else why.push("loss-making");
  if (roe != null) { const p = roe >= 20 ? 15 : roe >= 12 ? 8 : roe < 5 ? -8 : 0; s += p; why.push(`ROE ${roe.toFixed(0)}%`); }
  if (pg != null) { const p = pg >= 20 ? 15 : pg >= 8 ? 8 : pg < 0 ? -10 : 0; s += p; why.push(`profit ${pg >= 0 ? "+" : ""}${pg.toFixed(0)}% YoY`); }
  if (rg != null) { const p = rg >= 15 ? 10 : rg >= 5 ? 5 : rg < 0 ? -5 : 0; s += p; why.push(`revenue ${rg >= 0 ? "+" : ""}${rg.toFixed(0)}% YoY`); }
  if (de != null) { const p = de <= 0.3 ? 10 : de <= 1 ? 4 : de > 2 ? -10 : 0; s += p; why.push(`debt/equity ${de.toFixed(2)}`); }
  if (pe != null && pe > 0) { const p = pe <= 20 ? 10 : pe <= 35 ? 4 : pe > 60 ? -10 : 0; s += p; why.push(`P/E ${pe.toFixed(0)}`); }
  const score = Math.max(0, Math.min(100, Math.round(s)));
  return { score, reason: why.join(", "), pe, roe, debtToEquity: de, profitGrowth: pg, revenueGrowth: rg, profitable: niL > 0, asOf: ni.at(-1)?.date ?? null };
}

export async function getFundamentals(symbol: string, yahooSymbol?: string): Promise<Fundamentals | null> {
  const key = `__FUND__:${symbol}`;
  const { data: c } = await supabaseAdmin.from("price_cache").select("payload, updated_at").eq("symbol", key).maybeSingle();
  if (c && Date.now() - new Date(c.updated_at).getTime() < 7 * 86400000) return (c.payload as any)?.f ?? null;
  const ys = yahooSymbol ?? `${symbol}.NS`;
  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ys)}?type=${TYPES.join(",")}&period1=${now - 6 * 365 * 86400}&period2=${now}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const f = scoreFundamentals(await res.json());
    await supabaseAdmin.from("price_cache").upsert({ symbol: key, payload: { f } as any, updated_at: new Date().toISOString() }, { onConflict: "symbol" });
    return f;
  } catch { return null; }
}
