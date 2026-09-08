import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { getJournal, updateJournalOutcomes } from "@/lib/market.functions";
import { JournalAgent } from "@/components/JournalAgent";
import { OutcomeLearning } from "@/components/OutcomeLearning";
import { BookOpen, Loader2, RefreshCw, Trophy, TrendingDown, Hourglass, Percent, Target } from "lucide-react";



export const Route = createFileRoute("/journal")({
  component: Journal,
  head: () => ({ meta: [
    { title: "Trade Journal · TrendMatrix AI" },
    { name: "description", content: "Auto-logged AI recommendations with win rate, losers, and in-progress status." },
  ] }),
});

type Entry = {
  id: string; symbol: string; name: string | null; sector: string | null;
  kind: string; entry_price: number; target_price: number | null;
  current_price: number | null; peak_price: number | null;
  status: string; suggested_at: string; closed_at: string | null;
  swing_score: number | null; tags: string[] | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function pct(cur: number | null, entry: number) {
  if (!cur || !entry) return null;
  return ((cur - entry) / entry) * 100;
}

function daysBetween(from: string, to: string | null) {
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(from).getTime()) / 86400000));
}

function humanDays(d: number) {
  if (d < 1) return "same day";
  if (d < 30) return `${d}d`;
  const m = Math.floor(d / 30);
  const rem = d % 30;
  return rem ? `${m}mo ${rem}d` : `${m}mo`;
}

function StatusBadge({ s }: { s: string }) {
  if (s === "winner") return <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-mono uppercase text-success">winner</span>;
  if (s === "loser") return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-mono uppercase text-destructive">loser</span>;
  return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-mono uppercase text-primary">in progress</span>;
}

function Section({ title, icon, entries }: { title: string; icon: React.ReactNode; entries: Entry[] }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{entries.length}</span>
      </div>
      <div className="overflow-x-auto rounded-xl glass">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-mono uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Suggested</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Target (+10%)</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">P/L</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Closed</th>
              <th className="px-3 py-2">Time held</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No entries yet.</td></tr>
            )}
            {entries.map((e) => {
              // For closed TP hits, show the realized return at target (peak), not the pulled-back price.
              const closedWin = e.status === "winner";
              const p = closedWin
                ? Math.max(pct(e.peak_price, e.entry_price) ?? 10, 10)
                : pct(e.current_price, e.entry_price);
              const target = e.entry_price ? e.entry_price * 1.1 : null;
              return (
                <tr key={e.id} className="border-t border-border/60 hover:bg-secondary/20">
                  <td className="px-3 py-2 font-mono font-semibold">
                    <div className="flex items-center gap-1.5">
                      {e.symbol}
                      {e.kind === "etf" && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono uppercase text-primary">ETF</span>
                      )}
                    </div>
                    <div className="text-[10px] font-normal text-muted-foreground">{e.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.sector ?? "—"}</td>
                  <td className="px-3 py-2 text-[10px] uppercase">{e.kind}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(e.suggested_at)}</td>
                  <td className="px-3 py-2 font-mono">₹{Number(e.entry_price).toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{target ? `₹${target.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2 font-mono">
                    {closedWin
                      ? (e.peak_price ? `₹${Number(e.peak_price).toFixed(2)}` : target ? `₹${target.toFixed(2)}` : "—")
                      : e.current_price ? `₹${Number(e.current_price).toFixed(2)}` : "—"}
                    {closedWin && <div className="text-[9px] text-muted-foreground">at target</div>}
                  </td>
                  <td className={`px-3 py-2 font-mono ${p == null ? "" : p >= 0 ? "text-success" : "text-destructive"}`}>
                    {p == null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2"><StatusBadge s={e.status} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(e.closed_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {humanDays(daysBetween(e.suggested_at, e.closed_at))}
                    {!e.closed_at && <span className="ml-1 text-[10px] text-muted-foreground">running</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return (
    <div className={`rounded-xl glass p-4 ${tone ?? ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-gradient">{value}</div>
    </div>
  );
}

type Filter = "all" | "tp_hit" | "winners" | "losers" | "in_progress";

function retPct(e: Entry) {
  const p = pct(e.current_price, e.entry_price);
  return p ?? 0;
}
function isTpHit(e: Entry) {
  return e.status === "winner";
}
// Winners = still-running trades currently in profit (TP hits are their own bucket).
function isWinner(e: Entry) {
  return e.status === "in_progress" && retPct(e) > 0;
}
function isLoser(e: Entry) {
  return e.status === "loser" || (e.status === "in_progress" && retPct(e) < 0);
}

function Journal() {
  const fetchJ = useServerFn(getJournal);
  const refresh = useServerFn(updateJournalOutcomes);
  const [data, setData] = useState<{ entries: Entry[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setLoading(true);
    try { setData((await fetchJ()) as any); } finally { setLoading(false); }
  }
  useEffect(() => {
    // auto-close trades that hit +10% before showing the log
    (async () => {
      try { await refresh(); } catch { /* ignore */ }
      await load();
    })();
  }, []);

  async function refreshOutcomes() {
    setBusy(true);
    try { await refresh(); await load(); } finally { setBusy(false); }
  }

  const all = data?.entries ?? [];
  const shown = all.filter((e) =>
    filter === "all" ? true
    : filter === "tp_hit" ? isTpHit(e)
    : filter === "winners" ? isWinner(e)
    : filter === "losers" ? isLoser(e)
    : e.status === "in_progress",
  );

  const avgReturn = Number(data?.stats?.avgReturn ?? 0);
  const closedWins = all.filter((e) => e.status === "winner" && e.closed_at);
  const avgDays = closedWins.length
    ? Math.round(closedWins.reduce((s, e) => s + daysBetween(e.suggested_at, e.closed_at), 0) / closedWins.length)
    : null;
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: all.length },
    { key: "tp_hit", label: "TP hit", count: all.filter(isTpHit).length },
    { key: "winners", label: "Winners", count: all.filter(isWinner).length },
    { key: "losers", label: "Losers", count: all.filter(isLoser).length },
    { key: "in_progress", label: "In progress", count: all.filter((e) => e.status === "in_progress").length },
  ];

  return (
    <div className="min-h-screen">
      <SiteNav /><Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Auto-logged AI Track Record</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Trade Journal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every recommendation is auto-saved here. Target = +10% within 3 months. Trades that reach +10% show under “TP hit”; running trades in profit show under Winners, running trades in loss under Losers.
            </p>
          </div>
          <button onClick={refreshOutcomes} disabled={busy}
            className="flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold !text-white glow disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh outcomes
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl glass" />)}
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-7">
              <Kpi label="Win rate" value={`${(((data?.stats.winRate ?? 0) * 100)).toFixed(0)}%`} icon={<Trophy className="h-4 w-4 text-success" />} />
              <Kpi label="Avg return" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`} icon={<Percent className="h-4 w-4 text-primary" />} />
              <Kpi label="Avg time to target" value={avgDays == null ? "—" : humanDays(avgDays)} icon={<Hourglass className="h-4 w-4 text-primary" />} />
              <Kpi label="TP hit" value={String(all.filter(isTpHit).length)} icon={<Target className="h-4 w-4 text-success" />} />
              <Kpi label="Winners (running)" value={String(all.filter(isWinner).length)} icon={<Trophy className="h-4 w-4 text-success" />} />
              <Kpi label="Losers" value={String(all.filter(isLoser).length)} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
              <Kpi label="In progress" value={String(data?.stats.inProgress ?? 0)} icon={<Hourglass className="h-4 w-4 text-primary" />} />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-mono uppercase transition ${
                    filter === f.key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {f.label} <span className="opacity-70">{f.count}</span>
                </button>
              ))}
            </div>

            <JournalAgent />

            <Section title="Picks log (stocks & ETFs)" icon={<BookOpen className="h-4 w-4 text-primary" />} entries={shown} />
          </>
        )}
      </div>
    </div>
  );
}

