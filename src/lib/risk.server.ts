// Server-only helpers for the Market Risk Radar: global/local market telemetry
// plus geopolitical, policy and market news gathering.
import { fetchYahooChart } from "./yahoo.server";

export type MarketStat = {
  key: string;
  label: string;
  value: number | null;
  change_pct: number | null;
  vs_50dma_pct: number | null;
  drawdown_pct: number | null;
  note: string;
};

const TRACKED: { key: string; label: string; symbol: string }[] = [
  { key: "nifty", label: "Nifty 50", symbol: "^NSEI" },
  { key: "sensex", label: "Sensex", symbol: "^BSESN" },
  { key: "banknifty", label: "Bank Nifty", symbol: "^NSEBANK" },
  { key: "vix", label: "India VIX", symbol: "^INDIAVIX" },
  { key: "usdinr", label: "USD / INR", symbol: "USDINR=X" },
  { key: "brent", label: "Brent crude", symbol: "BZ=F" },
  { key: "gold", label: "Gold", symbol: "GC=F" },
  { key: "dxy", label: "Dollar index", symbol: "DX-Y.NYB" },
  { key: "spx", label: "S&P 500", symbol: "^GSPC" },
  { key: "ust10y", label: "US 10Y yield", symbol: "^TNX" },
];

function pct(a: number, b: number) {
  return b ? ((a - b) / b) * 100 : 0;
}

export async function getMarketTelemetry(): Promise<MarketStat[]> {
  const out: MarketStat[] = [];
  for (const t of TRACKED) {
    try {
      const r = await fetchYahooChart(t.symbol, "1y", "1d");
      if (!r || !r.candles?.length) continue;
      const closes = r.candles.map((c: any) => c.c).filter((n: number) => Number.isFinite(n));
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2] ?? last;
      const dma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / Math.min(50, closes.length);
      const high52 = Math.max(...closes);
      const change_pct = pct(last, prev);
      const vs50 = pct(last, dma50);
      const dd = pct(last, high52);
      let note = "";
      if (t.key === "vix") {
        note = last >= 22 ? "elevated fear" : last >= 16 ? "rising caution" : "calm";
      } else if (t.key === "nifty" || t.key === "sensex" || t.key === "banknifty") {
        note = dd <= -10 ? "correction territory" : dd <= -5 ? "pullback from highs" : vs50 >= 0 ? "above 50DMA" : "below 50DMA";
      } else {
        note = change_pct >= 1 ? "moving up" : change_pct <= -1 ? "moving down" : "stable";
      }
      out.push({
        key: t.key, label: t.label,
        value: Number(last.toFixed(2)),
        change_pct: Number(change_pct.toFixed(2)),
        vs_50dma_pct: Number(vs50.toFixed(2)),
        drawdown_pct: Number(dd.toFixed(2)),
        note,
      });
    } catch {
      // skip unavailable feed
    }
  }
  return out;
}

export type NewsItem = { title: string; source: string; published: string; topic: string; link: string };

const FEEDS: { topic: string; query: string }[] = [
  { topic: "Geopolitics", query: "India geopolitical tension war conflict" },
  { topic: "Global risk", query: "global markets selloff recession crash risk" },
  { topic: "Indian market", query: "Nifty Sensex FII selling stock market India" },
  { topic: "Policy / RBI", query: "RBI policy repo rate inflation India" },
  { topic: "Government / Budget", query: "Government of India policy budget tariff regulation markets" },
  { topic: "Commodities / Currency", query: "crude oil price rupee dollar India impact" },
];

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}

async function fetchFeed(topic: string, query: string, limit = 8): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:3d")}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 TrendMatrixAI/1.0" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1, limit + 1);
    return items.map((chunk) => {
      const g = (tag: string) => decode(chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
      return {
        title: g("title"),
        source: g("source") || "Google News",
        published: g("pubDate"),
        link: g("link"),
        topic,
      };
    }).filter((i) => i.title);
  } catch {
    return [];
  }
}

export async function gatherNews(): Promise<NewsItem[]> {
  const batches = await Promise.all(FEEDS.map((f) => fetchFeed(f.topic, f.query)));
  return batches.flat();
}

// Quantitative baseline risk (0-100) computed purely from telemetry so the
// radar still works even if the AI narrative call fails.
export function quantRisk(stats: MarketStat[]) {
  const by = Object.fromEntries(stats.map((s) => [s.key, s]));
  let score = 12;
  const drivers: string[] = [];
  const vix = by.vix?.value ?? null;
  if (vix != null) {
    if (vix >= 25) { score += 28; drivers.push(`India VIX at ${vix} — panic-level volatility`); }
    else if (vix >= 18) { score += 16; drivers.push(`India VIX at ${vix} — rising fear`); }
    else if (vix >= 14) { score += 7; drivers.push(`India VIX at ${vix} — mild caution`); }
  }
  const nifty = by.nifty;
  if (nifty) {
    const dd = nifty.drawdown_pct ?? 0;
    if (dd <= -12) { score += 26; drivers.push(`Nifty ${dd.toFixed(1)}% below its 52-week high — deep correction`); }
    else if (dd <= -6) { score += 15; drivers.push(`Nifty ${dd.toFixed(1)}% off highs — distribution phase`); }
    else if (dd <= -3) { score += 7; drivers.push(`Nifty ${dd.toFixed(1)}% off highs — normal pullback`); }
    if ((nifty.vs_50dma_pct ?? 0) < 0) { score += 8; drivers.push("Nifty trading below its 50-day average"); }
  }
  if ((by.usdinr?.change_pct ?? 0) >= 0.4) { score += 6; drivers.push("Rupee weakening sharply against the dollar"); }
  if ((by.brent?.change_pct ?? 0) >= 3) { score += 6; drivers.push("Crude spiking — imported inflation risk"); }
  if ((by.dxy?.change_pct ?? 0) >= 0.6) { score += 5; drivers.push("Dollar index surging — FII outflow pressure"); }
  if ((by.spx?.change_pct ?? 0) <= -1.5) { score += 8; drivers.push("Wall Street selling off — global risk-off"); }
  if ((by.ust10y?.change_pct ?? 0) >= 3) { score += 5; drivers.push("US 10Y yields jumping — liquidity tightening"); }
  return { score: Math.max(0, Math.min(100, Math.round(score))), drivers };
}

export function levelFor(score: number) {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "elevated";
  return "low";
}
