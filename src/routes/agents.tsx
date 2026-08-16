import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { PinGate } from "@/components/PinGate";
import { agents } from "@/lib/mockData";
import { getAgentChat, sendAgentChat, backtestWeekly } from "@/lib/market.functions";
import { ChevronRight, Cpu, CheckCircle2, XCircle, MessageSquare, Send, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/agents")({ component: AgentsPage,
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

function AgentsPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <PinGate area="AI Agents">
        <Agents />
      </PinGate>
    </div>
  );
}

function Agents() {
  return (
    <div className="min-h-screen">
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
                {a.id === "weekly" && <WeeklyBacktest />}
                <AgentChat agent={a.id === "weekly" ? "weekly_consolidation" : a.id} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgentChat({ agent }: { agent: string }) {
  const fetchChat = useServerFn(getAgentChat);
  const send = useServerFn(sendAgentChat);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ role: string; message: string; created_at: string }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const rows = await fetchChat({ data: { agent } });
    setMsgs((rows as any[]).filter((r) => r.role === "user" || r.role === "assistant" || r.role === "rule"));
  }
  useEffect(() => { if (open) load(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await send({ data: { agent, message: text.trim() } });
      setText("");
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-primary">
        <span className="inline-flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Coach this agent (chat)</span>
        <span className="text-[10px] font-mono text-muted-foreground">{open ? "hide" : "open"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md bg-card/40 p-2">
            {msgs.length === 0 && (
              <div className="p-3 text-center text-[11px] text-muted-foreground">
                Tell the agent what it got wrong. Example: "You missed ADANIPORTS — long flat base 1500–1600 with breakout at 1600. Increase weight on long bases."
              </div>
            )}
            {msgs.map((m, idx) => (
              <div key={idx}
                className={`rounded-md px-2 py-1.5 text-xs ${
                  m.role === "user" ? "ml-6 bg-primary/15 text-foreground"
                  : m.role === "rule" ? "border border-success/40 bg-success/10 text-success"
                  : "mr-6 bg-secondary text-foreground"}`}>
                <div className="text-[9px] font-mono uppercase opacity-60">{m.role === "rule" ? "saved rule" : m.role}</div>
                <div className="mt-0.5 whitespace-pre-wrap">{m.message}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="mt-2 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
              placeholder="Tell the agent a mistake or new rule…"
              className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs" />
            <button onClick={submit} disabled={busy || !text.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold !text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Send
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Each AI reply that ends with <code className="font-mono">RULE: ...</code> is auto-saved and applied on the next scan.
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyBacktest() {
  const run = useServerFn(backtestWeekly);
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function go() {
    setBusy(true);
    try { setResult(await run({ data: { threshold } })); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-4 rounded-lg border border-violet-400/30 bg-violet-400/5 p-3">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-violet-300">
        <span className="inline-flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Backtest weekly detector on training library</span>
        <span className="text-[10px] font-mono text-muted-foreground">{open ? "hide" : "open"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground">Threshold</label>
            <input type="number" min={40} max={95} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 70)}
              className="w-20 rounded-md border border-border bg-card px-2 py-1 text-xs" />
            <button onClick={go} disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold !text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Run backtest
            </button>
            <span className="text-[10px] text-muted-foreground">Includes successful + failed (removed) picks.</span>
          </div>

          {result && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <Metric label="Examples" value={result.total} />
                <Metric label="Precision" value={`${(result.precision * 100).toFixed(0)}%`} />
                <Metric label="Recall" value={`${(result.recall * 100).toFixed(0)}%`} />
                <Metric label="Accuracy" value={`${(result.accuracy * 100).toFixed(0)}%`} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono text-muted-foreground">
                <span>TP {result.tp}</span><span>FP {result.fp}</span>
                <span>FN {result.fn}</span><span>TN {result.tn}</span>
              </div>
              <div className="rounded-md border border-success/30 bg-success/5 p-2">
                <div className="text-[10px] font-mono uppercase text-success">Recommendations</div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                  {result.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-secondary/40 text-[10px] font-mono uppercase text-muted-foreground">
                    <tr><th className="p-1.5">Symbol</th><th className="p-1.5">Label</th><th className="p-1.5">Score</th><th className="p-1.5">Pred</th><th className="p-1.5"></th></tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r: any, i: number) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-1.5 font-semibold">{r.symbol}</td>
                        <td className="p-1.5 text-muted-foreground">{r.label}</td>
                        <td className="p-1.5 font-mono">{r.weekly_score}</td>
                        <td className="p-1.5">{r.predicted_breakout ? "✓" : "—"}</td>
                        <td className={`p-1.5 ${r.correct ? "text-success" : "text-destructive"}`}>{r.correct ? "ok" : "miss"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
