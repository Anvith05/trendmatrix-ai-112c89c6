import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import {
  runBacktest, getBacktestRuns, getBacktestTrades, markBacktestTradeWrong,
} from "@/lib/market.functions";
import { Loader2, Play, Trophy, TrendingDown, Flag, X } from "lucide-react";

export const Route = createFileRoute("/backtest")({
  component: BacktestPage,
  head: () => ({ meta: [
    { title: "Strategy Backtest · TrendMatrix AI" },
    { name: "description", content: "Backtest the weekly-consolidation breakout strategy from 2000 to present. Mark wrong picks to train the AI." },
  ] }),
});

type Run = {
  id: string; from_date: string; to_date: string; started_at: string; finished_at: string | null;
  total_trades: number; winners: number; losers: number; win_rate: number; avg_return: number;
};
type Trade = {
  id: string; symbol: string; name: string | null; sector: string | null;
  entry_date: string; entry_price: number; exit_date: string | null; exit_price: number | null;
  peak_price: number | null; return_pct: number | null; bars_held: number | null;
  outcome: string; pattern: string | null; base_range_pct: number | null;
  marked_wrong: boolean; wrong_reason: string | null;
};

function fmtPct(n: number | null) { return n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

function BacktestPage() {
  const runFn = useServerFn(runBacktest);
  const getRuns = useServerFn(getBacktestRuns);
  const getTrades = useServerFn(getBacktestTrades);
  const markWrong = useServerFn(markBacktestTradeWrong);

  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<string | "">("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [from, setFrom] = useState("2000-01-01");
  const [maxSyms, setMaxSyms] = useState(20);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"all" | "winner" | "loser" | "wrong">("all");

  async function loadRuns() {
    const r = (await getRuns()) as any;
    setRuns(r.runs);
    if (r.runs.length && !activeRun) setActiveRun(r.runs[0].id);
  }
  async function loadTrades(runId?: string) {
    if (!runId) { setTrades([]); return; }
    const t = (await getTrades({ data: { runId } })) as any;
    setTrades(t.trades);
  }

  useEffect(() => { (async () => { setLoading(true); await loadRuns(); setLoading(false); })(); }, []);
  useEffect(() => { loadTrades(activeRun || undefined); }, [activeRun]);

  async function startBacktest() {
    setBusy(true);
    try {
      const r = (await runFn({ data: { from, maxSymbols: maxSyms } })) as any;
      await loadRuns();
      setActiveRun(r.runId);
    } finally { setBusy(false); }
  }

  async function saveWrong(id: string) {
    if (!reason.trim()) return;
    await markWrong({ data: { id, reason: reason.trim() } });
    setMarking(null); setReason("");
    await loadTrades(activeRun || undefined);
  }

  const visible = trades.filter((t) => {
    if (filter === "all") return true;
    if (filter === "wrong") return t.marked_wrong;
    return t.outcome === filter;
  });

  const currentRun = runs.find((r) => r.id === activeRun);

  return (
    <div className="min-h-screen">
      <SiteNav /><Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Historical Strategy Validation</div>
          <h1 className="mt-1 font-display text-3xl font-bold">Backtest (2000 → today)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Replays the weekly-consolidation breakout strategy on real Yahoo history. Mark trades the AI got wrong with a reason —
            those become feedback the live agents can learn from.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl glass p-4">
          <label className="text-xs font-mono uppercase text-muted-foreground">
            From date
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs font-mono uppercase text-muted-foreground">
            Max symbols (scan size)
            <input type="number" min={1} max={200} value={maxSyms} onChange={(e) => setMaxSyms(Number(e.target.value))}
              className="mt-1 block w-32 rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
          </label>
          <button onClick={startBacktest} disabled={busy}
            className="flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold !text-white glow disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "Running backtest…" : "Run backtest"}
          </button>
          {runs.length > 0 && (
            <label className="ml-auto text-xs font-mono uppercase text-muted-foreground">
              Pick a past run
              <select value={activeRun} onChange={(e) => setActiveRun(e.target.value)}
                className="mt-1 block rounded-md border border-border bg-card px-2 py-1.5 text-sm">
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.started_at).toLocaleDateString()} · {r.from_date} → {r.to_date} · {r.total_trades} trades
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* KPI strip */}
        {currentRun && (
          <div className="mb-6 grid gap-3 md:grid-cols-5">
            <Kpi label="Period" value={`${currentRun.from_date} → ${currentRun.to_date}`} />
            <Kpi label="Trades" value={String(currentRun.total_trades)} />
            <Kpi label="Win rate" value={`${(currentRun.win_rate * 100).toFixed(0)}%`} icon={<Trophy className="h-4 w-4 text-success" />} />
            <Kpi label="Winners / Losers" value={`${currentRun.winners} / ${currentRun.losers}`} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
            <Kpi label="Avg return" value={fmtPct(currentRun.avg_return)} />
          </div>
        )}

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["all", "winner", "loser", "wrong"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase ${filter === f
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs font-mono text-muted-foreground">{visible.length} trades</span>
        </div>

        {/* Trades */}
        <div className="overflow-x-auto rounded-xl glass">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-mono uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2">Entry → Exit</th>
                <th className="px-3 py-2">Entry ₹</th>
                <th className="px-3 py-2">Exit ₹</th>
                <th className="px-3 py-2">Return</th>
                <th className="px-3 py-2">Bars</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No trades yet. Run a backtest to populate.
                </td></tr>
              )}
              {visible.map((t) => (
                <FragmentRow key={t.id} t={t} marking={marking} reason={reason} setMarking={setMarking} setReason={setReason} saveWrong={saveWrong} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ t, marking, reason, setMarking, setReason, saveWrong }: {
  t: Trade; marking: string | null; reason: string;
  setMarking: (id: string | null) => void; setReason: (s: string) => void;
  saveWrong: (id: string) => void;
}) {
  return (
    <>
      <tr className={`border-t border-border/60 hover:bg-secondary/20 ${t.marked_wrong ? "bg-destructive/5" : ""}`}>
        <td className="px-3 py-2 font-mono font-semibold">
          {t.symbol}
          <div className="text-[10px] font-normal text-muted-foreground">{t.name}</div>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{t.sector ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{t.entry_date} → {t.exit_date ?? "—"}</td>
        <td className="px-3 py-2 font-mono">₹{Number(t.entry_price).toFixed(2)}</td>
        <td className="px-3 py-2 font-mono">{t.exit_price ? `₹${Number(t.exit_price).toFixed(2)}` : "—"}</td>
        <td className={`px-3 py-2 font-mono ${(t.return_pct ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
          {fmtPct(t.return_pct)}
        </td>
        <td className="px-3 py-2 text-xs">{t.bars_held ?? "—"}</td>
        <td className="px-3 py-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${
            t.outcome === "winner" ? "bg-success/15 text-success"
            : t.outcome === "loser" ? "bg-destructive/15 text-destructive"
            : "bg-muted text-muted-foreground"
          }`}>{t.outcome}</span>
        </td>
        <td className="px-3 py-2">
          {t.marked_wrong ? (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-mono uppercase text-destructive">marked wrong</span>
          ) : (
            <button onClick={() => { setMarking(t.id); setReason(""); }}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10">
              <Flag className="h-3 w-3" /> Mark wrong
            </button>
          )}
        </td>
      </tr>
      {marking === t.id && (
        <tr className="border-t border-destructive/30 bg-destructive/5">
          <td colSpan={9} className="px-3 py-3">
            <div className="flex items-start gap-2">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="Why was this pick wrong? e.g. base too short, breakout was fake, news-driven spike…"
                className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs" />
              <button onClick={() => saveWrong(t.id)} disabled={!reason.trim()}
                className="rounded-md bg-destructive px-3 py-1.5 text-[11px] font-semibold !text-white disabled:opacity-50">
                Save & train
              </button>
              <button onClick={() => setMarking(null)} className="rounded-md border border-border px-2 py-1.5"><X className="h-3 w-3" /></button>
            </div>
            {t.wrong_reason && <div className="mt-1 text-[10px] text-muted-foreground">Existing reason: {t.wrong_reason}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="mt-1 font-display text-lg font-bold text-gradient">{value}</div>
    </div>
  );
}
