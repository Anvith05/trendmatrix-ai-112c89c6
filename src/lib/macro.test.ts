import { describe, it, expect } from "vitest";
import { computeRiskScore, regimeFromScore } from "./macro";

const i = (value: number | null, chg1m: number | null, aboveSma50: boolean | null = null) => ({ key: "", label: "", value, chg1m, aboveSma50 });

describe("macro regime", () => {
  it("calm market is risk-on", () => {
    const r = computeRiskScore({ vix: i(12, 0), nifty: i(25000, 4, true) });
    expect(regimeFromScore(r.score)).toBe("risk_on");
  });
  it("panic VIX + falling Nifty is crash watch", () => {
    const r = computeRiskScore({ vix: i(25, 30), nifty: i(22000, -8, false) });
    expect(regimeFromScore(r.score)).toBe("crash_watch");
  });
  it("thresholds", () => {
    expect(regimeFromScore(44)).toBe("risk_on");
    expect(regimeFromScore(45)).toBe("caution");
    expect(regimeFromScore(65)).toBe("crash_watch");
  });
});
