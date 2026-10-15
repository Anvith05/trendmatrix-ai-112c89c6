// Pure regime math (browser-safe, testable). Indian equities only; global data is context.
export type MacroIndicator = {
  key: string; label: string; value: number | null; chg1m: number | null; aboveSma50: boolean | null;
};
export type Regime = "risk_on" | "caution" | "crash_watch";

/** Risk score 0-100 (higher = more danger) from transparent rules. */
export function computeRiskScore(ind: Record<string, MacroIndicator | undefined>, yieldCurve: number | null = null): { score: number; flags: string[] } {
  let s = 30; const flags: string[] = [];
  const vix = ind.vix?.value;
  if (vix != null) {
    if (vix >= 22) { s += 25; flags.push(`India VIX ${vix.toFixed(1)} — panic-level volatility`); }
    else if (vix >= 17) { s += 12; flags.push(`India VIX ${vix.toFixed(1)} — elevated hedging`); }
    else if (vix < 13) s -= 8;
  }
  const n = ind.nifty;
  if (n?.aboveSma50 === false) { s += 12; flags.push("Nifty below its 50-day average"); }
  if (n?.chg1m != null && n.chg1m <= -6) { s += 15; flags.push(`Nifty ${n.chg1m.toFixed(1)}% in a month — correction underway`); }
  else if (n?.chg1m != null && n.chg1m >= 3) s -= 8;
  const crude = ind.crude?.chg1m;
  if (crude != null && crude >= 12) { s += 8; flags.push(`Brent +${crude.toFixed(1)}% in a month — pressure on India inflation`); }
  const dxy = ind.dxy?.chg1m;
  if (dxy != null && dxy >= 2.5) { s += 6; flags.push("Dollar spiking — FII outflow risk"); }
  const us10 = ind.us10y?.chg1m;
  if (us10 != null && us10 >= 8) { s += 5; flags.push("US 10Y yields rising fast"); }
  const spx = ind.spx?.chg1m;
  if (spx != null && spx <= -6) { s += 10; flags.push(`S&P 500 ${spx.toFixed(1)}% in a month — global risk-off`); }
  if (yieldCurve != null && yieldCurve < 0) { s += 8; flags.push(`US yield curve inverted (${yieldCurve.toFixed(2)}) — recession warning`); }
  const cu = ind.copper?.chg1m;
  if (cu != null && cu <= -8) { s += 6; flags.push(`Copper ${cu.toFixed(1)}% in a month — industrial slowdown signal`); }
  return { score: Math.max(0, Math.min(100, Math.round(s))), flags };
}

export function regimeFromScore(score: number): Regime {
  if (score >= 65) return "crash_watch";
  if (score >= 45) return "caution";
  return "risk_on";
}
