import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { agents } from "@/lib/mockData";
import { ChevronRight, Cpu, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/agents")({ component: Agents,
  head: () => ({ meta: [{ title: "AI Agent Flow · TrendMatrix AI" }] }),
});

const reasonings: Record<string, { accepted: string[]; rejected: string[]; reasoning: string }> = {
  data: {
    accepted: ["NSE feed locked", "BSE feed locked", "Yahoo backup ready"],
    rejected: ["EOD-only sources skipped"],
    reasoning: "Streaming OHLCV (1m, weekly, monthly) + delivery % across 2,147 NSE/BSE listings.",
  },
  monthly: {
    accepted: ["HAL +94", "BEL +91", "RVNL +89", "TITAGARH +88"],
    rejected: ["TCS — broken structure", "INFY — lower highs"],
    reasoning: "Higher highs + higher lows over 24+ monthly candles. Macro trend > 200WMA confirmed.",
  },
  weekly: {
    accepted: ["BDL — 11w base", "MAZDOCK — VCP", "BEL — cup & handle"],
    rejected: ["RELIANCE — too extended"],
    reasoning: "Volatility contraction, volume dry-up, ATR collapse. Tight closes near range high.",
  },
  sector: {
    accepted: ["Defence 94 sync", "Railways 90", "PSU 86"],
    rejected: ["IT 40 — diverging", "FMCG 50 — neutral"],
    reasoning: "≥40% of sector members basing on weekly while monthly remains bullish → rally priming.",
  },
  history: { accepted: ["Defence 2023 analog", "PSU 2022 analog"], rejected: ["No 2008-style match"], reasoning: "Vector similarity vs 10-yr Indian rally library + user-uploaded patterns." },
  fundamental: { accepted: ["ROCE > 18%", "FII inflow positive"], rejected: ["High-debt names dropped"], reasoning: "Earnings momentum, promoter holding, cash flow quality." },
  macro: { accepted: ["Defence capex +18%", "Railways budget +24%"], rejected: ["No adverse RBI signal"], reasoning: "Adjusts conviction only — never overrides technicals." },
  master: { accepted: ["12 high-conviction setups"], rejected: ["Borderline candidates parked in watchlist"], reasoning: "Weighted ensemble: monthly·0.30 + weekly·0.25 + sectorSync·0.20 + similarity·0.15 + RS/Vol·0.10." },
};

function Agents() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Multi-Agent Workflow</div>
          <h1 className="mt-1 font-display text-3xl font-bold">8 specialized AI agents · sequential conviction pipeline</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Each agent inspects the output of the previous one. Stocks must survive every stage to reach Master AI ranking.
          </p>
        </div>

        <div className="space-y-3">
          {agents.map((a, i) => {
            const r = reasonings[a.id];
            return (
              <div key={a.id} className="relative rounded-xl glass p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--gradient-primary)] glow">
                    <Cpu className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Agent {i + 1}</div>
                      <h3 className="text-lg font-semibold">{a.name}</h3>
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-mono uppercase text-success">{a.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r?.reasoning}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-mono uppercase text-success">
                          <CheckCircle2 className="h-3 w-3" /> Accepted
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {r?.accepted.map((x) => (
                            <span key={x} className="rounded-md border border-success/30 bg-success/5 px-2 py-0.5 text-xs">{x}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-mono uppercase text-destructive">
                          <XCircle className="h-3 w-3" /> Rejected
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {r?.rejected.map((x) => (
                            <span key={x} className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs">{x}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground">
                    <div>in <span className="text-foreground">{a.processed}</span></div>
                    <div>out <span className="text-primary">{a.accepted}</span></div>
                  </div>
                </div>
                {i < agents.length - 1 && (
                  <div className="absolute -bottom-3 left-9 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                    <ChevronRight className="h-3 w-3 rotate-90 text-primary" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
