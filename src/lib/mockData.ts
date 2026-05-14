// Synthetic seed data approximating Indian market sectors. Replace with live NSE/BSE feed once Python microservices are wired.
export type Sector = {
  id: string;
  name: string;
  monthlyTrend: number;     // -100..100
  weeklyConsolidation: number; // 0..100
  syncScore: number;        // 0..100
  basingCount: number;
  totalStocks: number;
  rs: number;               // -50..50
};

export type Stock = {
  symbol: string;
  name: string;
  sector: string;
  ltp: number;
  changePct: number;
  monthlyScore: number;
  weeklyScore: number;
  rs: number;
  volumeAccum: number;
  swingScore: number;
  status: "basing" | "breaking_out" | "watch";
};

export const sectors: Sector[] = [
  { id: "defence", name: "Defence", monthlyTrend: 92, weeklyConsolidation: 88, syncScore: 94, basingCount: 14, totalStocks: 22, rs: 42 },
  { id: "pharma", name: "Pharma", monthlyTrend: 78, weeklyConsolidation: 82, syncScore: 81, basingCount: 28, totalStocks: 64, rs: 28 },
  { id: "psu", name: "PSU", monthlyTrend: 84, weeklyConsolidation: 76, syncScore: 86, basingCount: 19, totalStocks: 38, rs: 35 },
  { id: "railways", name: "Railways", monthlyTrend: 88, weeklyConsolidation: 79, syncScore: 90, basingCount: 9, totalStocks: 14, rs: 38 },
  { id: "capgoods", name: "Capital Goods", monthlyTrend: 74, weeklyConsolidation: 71, syncScore: 76, basingCount: 22, totalStocks: 51, rs: 24 },
  { id: "infra", name: "Infrastructure", monthlyTrend: 70, weeklyConsolidation: 68, syncScore: 72, basingCount: 18, totalStocks: 47, rs: 21 },
  { id: "energy", name: "Energy", monthlyTrend: 62, weeklyConsolidation: 58, syncScore: 60, basingCount: 11, totalStocks: 32, rs: 12 },
  { id: "banking", name: "Banking", monthlyTrend: 55, weeklyConsolidation: 64, syncScore: 58, basingCount: 17, totalStocks: 42, rs: 8 },
  { id: "manufacturing", name: "Manufacturing", monthlyTrend: 68, weeklyConsolidation: 70, syncScore: 71, basingCount: 24, totalStocks: 58, rs: 18 },
  { id: "it", name: "IT", monthlyTrend: 35, weeklyConsolidation: 48, syncScore: 40, basingCount: 8, totalStocks: 38, rs: -8 },
  { id: "fmcg", name: "FMCG", monthlyTrend: 48, weeklyConsolidation: 52, syncScore: 50, basingCount: 12, totalStocks: 36, rs: 2 },
  { id: "auto", name: "Auto", monthlyTrend: 60, weeklyConsolidation: 62, syncScore: 64, basingCount: 14, totalStocks: 33, rs: 14 },
];

const sample: Record<string, { symbol: string; name: string }[]> = {
  defence: [
    { symbol: "HAL", name: "Hindustan Aeronautics" },
    { symbol: "BEL", name: "Bharat Electronics" },
    { symbol: "BDL", name: "Bharat Dynamics" },
    { symbol: "MAZDOCK", name: "Mazagon Dock" },
    { symbol: "COCHINSHIP", name: "Cochin Shipyard" },
    { symbol: "GRSE", name: "Garden Reach Shipbuilders" },
    { symbol: "DATAPATTNS", name: "Data Patterns" },
    { symbol: "PARAS", name: "Paras Defence" },
  ],
  pharma: [
    { symbol: "SUNPHARMA", name: "Sun Pharma" },
    { symbol: "DRREDDY", name: "Dr Reddy's" },
    { symbol: "CIPLA", name: "Cipla" },
    { symbol: "DIVISLAB", name: "Divi's Labs" },
    { symbol: "LUPIN", name: "Lupin" },
    { symbol: "AUROPHARMA", name: "Aurobindo Pharma" },
  ],
  psu: [
    { symbol: "IRFC", name: "Indian Railway Finance" },
    { symbol: "RVNL", name: "Rail Vikas Nigam" },
    { symbol: "PFC", name: "Power Finance Corp" },
    { symbol: "RECLTD", name: "REC Ltd" },
    { symbol: "NTPC", name: "NTPC" },
    { symbol: "COALINDIA", name: "Coal India" },
  ],
  railways: [
    { symbol: "TITAGARH", name: "Titagarh Rail" },
    { symbol: "JUPITERWAG", name: "Jupiter Wagons" },
    { symbol: "IRCTC", name: "IRCTC" },
    { symbol: "RAILTEL", name: "Railtel" },
    { symbol: "IRCON", name: "Ircon Intl" },
  ],
  capgoods: [
    { symbol: "LT", name: "Larsen & Toubro" },
    { symbol: "SIEMENS", name: "Siemens" },
    { symbol: "ABB", name: "ABB India" },
    { symbol: "BHEL", name: "BHEL" },
    { symbol: "CUMMINSIND", name: "Cummins India" },
  ],
  infra: [
    { symbol: "GMRINFRA", name: "GMR Infra" },
    { symbol: "IRB", name: "IRB Infra" },
    { symbol: "NCC", name: "NCC Ltd" },
    { symbol: "KECL", name: "KEC Intl" },
  ],
  energy: [
    { symbol: "RELIANCE", name: "Reliance Industries" },
    { symbol: "ONGC", name: "ONGC" },
    { symbol: "IOC", name: "Indian Oil" },
  ],
  banking: [
    { symbol: "HDFCBANK", name: "HDFC Bank" },
    { symbol: "ICICIBANK", name: "ICICI Bank" },
    { symbol: "SBIN", name: "State Bank of India" },
    { symbol: "AXISBANK", name: "Axis Bank" },
  ],
  manufacturing: [
    { symbol: "TATASTEEL", name: "Tata Steel" },
    { symbol: "JSWSTEEL", name: "JSW Steel" },
    { symbol: "HINDALCO", name: "Hindalco" },
  ],
  it: [
    { symbol: "TCS", name: "TCS" },
    { symbol: "INFY", name: "Infosys" },
    { symbol: "WIPRO", name: "Wipro" },
  ],
  fmcg: [
    { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
    { symbol: "ITC", name: "ITC" },
    { symbol: "NESTLEIND", name: "Nestle India" },
  ],
  auto: [
    { symbol: "M&M", name: "Mahindra & Mahindra" },
    { symbol: "TATAMOTORS", name: "Tata Motors" },
    { symbol: "MARUTI", name: "Maruti Suzuki" },
    { symbol: "BAJAJ-AUTO", name: "Bajaj Auto" },
  ],
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function stocksForSector(sectorId: string): Stock[] {
  const s = sectors.find((x) => x.id === sectorId);
  if (!s) return [];
  const r = rng(sectorId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  return (sample[sectorId] ?? []).map((row, i) => {
    const monthly = Math.round(60 + r() * 35);
    const weekly = Math.round(55 + r() * 40);
    const rs = Math.round((r() - 0.3) * 60);
    const va = Math.round(40 + r() * 55);
    const swing = Math.round(monthly * 0.35 + weekly * 0.4 + (rs + 50) * 0.15 + va * 0.1);
    const status: Stock["status"] = swing > 80 ? "breaking_out" : swing > 65 ? "basing" : "watch";
    return {
      symbol: row.symbol,
      name: row.name,
      sector: s.name,
      ltp: Math.round((100 + r() * 3000) * 100) / 100,
      changePct: Math.round((r() * 6 - 1) * 100) / 100,
      monthlyScore: monthly,
      weeklyScore: weekly,
      rs,
      volumeAccum: va,
      swingScore: swing,
      status,
    };
  });
}

export function topRanked(limit = 12): Stock[] {
  return sectors
    .flatMap((s) => stocksForSector(s.id))
    .sort((a, b) => b.swingScore - a.swingScore)
    .slice(0, limit);
}

export const agents = [
  { id: "data", name: "Live Market Data AI", status: "streaming", processed: 2147, accepted: 2147, color: "cyan" },
  { id: "sector", name: "Sector Sync AI", status: "active", processed: 2147, accepted: 980, color: "violet" },
  { id: "monthly", name: "Monthly Trend AI", status: "active", processed: 980, accepted: 612, color: "cyan" },
  { id: "weekly", name: "Weekly Consolidation AI", status: "active", processed: 612, accepted: 198, color: "violet" },
  { id: "history", name: "Historical Pattern AI", status: "active", processed: 198, accepted: 87, color: "cyan" },
  { id: "fundamental", name: "Fundamental Validation AI", status: "active", processed: 54, accepted: 41, color: "violet" },
  { id: "macro", name: "Macro / News AI", status: "active", processed: 41, accepted: 38, color: "cyan" },
  { id: "master", name: "Master Conviction AI", status: "ranking", processed: 38, accepted: 12, color: "violet" },
] as const;
