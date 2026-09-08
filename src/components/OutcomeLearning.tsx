import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOutcomeLearning, analyzeOutcomes } from "@/lib/market.functions";
import { Brain, Loader2, Sparkles } from "lucide-react";

type Verdict = { symbol: string; verdict: string; reason: string; fix: string };

function Rate({ label, o }: { label: string; o: { wins: number; losses: number; rate: number } }) {
  const pct = Math.round(o.rate * 100);
  const tone = pct >= 60 ? "text-success" : pct <= 35 ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-xs">
      <span className="truncate">{label}</span>
      <span className={`font-mono ${tone}`}>{pct}% · {o.wins}W/{o.losses}L</span>
    </div>
  );
}

export function OutcomeLearning() {
  const load = useServerFn(getOutcomeLearning);
  const run = useServerFn(analyzeOutcomes);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { load().then(setData).catch(() => {}); }, []);

  async function analyze() {
    setBusy(true); setErr(null);
    try {
      const r: any = await run();
      setResult(r);
      setData(await load());
    } catch (e: any) { setErr(String(e?.message ?? e)); }
    finally { setBusy(false); }
  }

  const stats = data?.stats;
  const sectors = Object.entries(stats?.sectors ?? {}) as [string, any][];
  const bands = Object.entries(stats?.scoreBands ?? {}) as [string, any][];
  const verdicts: Verdict[] = result?.verdicts ?? [];

  return (
    <section className="mb-8 rounded-xl glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">What the AI learned from winners &amp; losers</h2>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {open ? "hide" : "show"}
          </span>
        </button>
        <button onClick={analyze} disabled={busy}
          className="flex items-center gap-2 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Run post-mortem
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every graded trade is studied: a loser is marked <em>genuine</em> (good setup, market didn’t deliver) or a
        <em> mistake</em> the selection logic must fix. Sectors and patterns that keep failing are automatically
        penalised in the next scan; proven winning patterns get a small boost.
      </p>

      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] font-mono uppercase text-muted-foreground">Hit rate by sector</div>
            <div className="space-y-1.5">
              {sectors.length === 0 && <div className="text-xs text-muted-foreground">No graded trades yet.</div>}
              {sectors.sort((a, b) => b[1].rate - a[1].rate).map(([k, v]) => <Rate key={k} label={k} o={v} />)}
            </div>
            <div className="mb-2 mt-4 text-[10px] font-mono uppercase text-muted-foreground">Hit rate by swing-score band</div>
            <div className="space-y-1.5">
              {bands.map(([k, v]) => <Rate key={k} label={k} o={v} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-mono uppercase text-muted-foreground">Lessons applied to future picks</div>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>}
            <div className="space-y-1.5">
              {(data?.lessons ?? []).length === 0 && !err && (
                <div className="text-xs text-muted-foreground">Run the post-mortem to generate lessons.</div>
              )}
              {(data?.lessons ?? []).map((l: any) => (
                <div key={l.id} className="rounded-lg border border-success/30 bg-success/5 px-3 py-1.5 text-xs">{l.message}</div>
              ))}
            </div>
            {verdicts.length > 0 && (
              <>
                <div className="mb-2 mt-4 text-[10px] font-mono uppercase text-muted-foreground">Loser diagnosis</div>
                <div className="space-y-1.5">
                  {verdicts.map((v) => (
                    <div key={v.symbol} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">
                      <span className="font-mono font-semibold">{v.symbol}</span>{" "}
                      <span className={v.verdict === "mistake" ? "text-destructive" : "text-muted-foreground"}>
                        {v.verdict}
                      </span>
                      <div className="text-muted-foreground">{v.reason}</div>
                      {v.fix && <div className="text-primary">Fix: {v.fix}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
