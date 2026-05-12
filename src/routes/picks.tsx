import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { getQuote, getRecommendations, runAgents } from "@/lib/market.functions";
import { Sparkles, History, TrendingUp, Loader2, RefreshCw, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/picks")({
  component: Picks,
  head: () => ({ meta: [
    { title: "Top Picks · TrendMatrix AI" },
    { name: "description", content: "Top 5 AI-recommended swing trades from NSE/BSE with full pattern-match conviction." },
  ] }),
});

type Rec = {
  id: string; symbol: string; name: string | null; sector: string | null;
  ltp: number | null; entry_price: number | null;
  swing_score: number; monthly_score: number; weekly_score: number;
  history_score: number; volume_score: number; rs_score: number;
  tags: string[] | null; reasoning: any;
  status: string; outcome: string | null;
  recommended_at: string; archived_at: string | null; expires_at: string;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function timeLeft(expires: string) {
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function Picks() {
  const fetchRecs = useServerFn(getRecommendations);
  const runAgentsFn = useServerFn(runAgents);
  const [data, setData] = useState<{ active: Rec[]; history: Rec[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    try { setData(await fetchRecs()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function refresh() {
    setRefreshing(true);
    try { await runAgentsFn({ data: { source: "picks_manual" } }); await load(); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="min-h-screen">
      <SiteNav /><Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Strong AI Recommendations</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Top Picks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Up to 5 highest-conviction swing setups matching your training patterns. Auto-archived after 7 days.
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground glow disabled:opacity-60">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-scan now
          </button>
        </div>

        {/* Active picks */}
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Active picks</h2>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {data?.active.length ?? 0} / 5
            </span>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl glass" />
              ))}
            </div>
          ) : data && data.active.length === 0 ? (
            <div className="rounded-xl glass p-10 text-center text-sm text-muted-foreground">
              No high-conviction setups right now. The AI is being selective — re-scan to check again.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data?.active.map((r) => <PickCard key={r.id} r={r} />)}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Past recommendations</h2>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {data?.history.length ?? 0}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl glass">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-xs font-mono uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Symbol</th>
                  <th className="px-4 py-2">Sector</th>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Recommended</th>
                  <th className="px-4 py-2">Archived</th>
                  <th className="px-4 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {(data?.history ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/20">
                    <td className="px-4 py-2 font-mono font-semibold">
                      <Link to="/research" className="hover:text-primary">{r.symbol}</Link>
                      <div className="text-[10px] font-normal text-muted-foreground">{r.name}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.sector}</td>
                    <td className="px-4 py-2 font-mono">₹{Number(r.entry_price ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-2 font-mono">{r.swing_score}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(r.recommended_at)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.archived_at ? fmtDate(r.archived_at) : "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono uppercase">{r.outcome ?? "—"}</span>
                    </td>
                  </tr>
                ))}
                {(!data || data.history.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No archived picks yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function PickCard({ r }: { r: Rec }) {
  const bars: [string, number][] = [
    ["Monthly", r.monthly_score], ["Weekly", r.weekly_score],
    ["Pattern", r.history_score], ["Volume", r.volume_score], ["RS", r.rs_score],
  ];
  return (
    <div className="rounded-xl glass p-4 transition hover:border-primary/40">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold">{r.symbol}</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-mono uppercase text-success">Active</span>
          </div>
          <div className="text-xs text-muted-foreground">{r.name} · {r.sector}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold text-gradient">{r.swing_score}</div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">conviction</div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-xl font-semibold">₹{Number(r.entry_price ?? 0).toFixed(2)}</span>
        <span className="flex items-center gap-1 text-xs text-success"><TrendingUp className="h-3 w-3" /> Entry</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">{timeLeft(r.expires_at)}</span>
      </div>

      <PickChart symbol={r.symbol} entry={Number(r.entry_price ?? 0)} />

      <div className="mt-3 space-y-1.5">
        {bars.map(([k, v]) => (
          <div key={k}>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>{k}</span><span className="text-foreground">{v}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-[var(--gradient-primary)]" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>

      {(r.tags ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(r.tags ?? []).slice(0, 4).map((t) => (
            <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">{t}</span>
          ))}
        </div>
      )}

      <Link to="/research" className="mt-3 flex items-center justify-end gap-1 text-xs text-primary hover:underline">
        Open in Research <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function PickChart({ symbol, entry }: { symbol: string; entry: number }) {
  const fetchQuote = useServerFn(getQuote);
  const [candles, setCandles] = useState<{ t: number; c: number; h: number; l: number }[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchQuote({ data: { symbol } })
      .then((q: any) => { if (alive) setCandles((q?.candles ?? []).slice(-90)); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [symbol]);

  if (err) return <div className="mt-3 h-24 rounded-md bg-secondary/30 text-[10px] text-muted-foreground flex items-center justify-center">chart unavailable</div>;
  if (!candles) return <div className="mt-3 h-24 animate-pulse rounded-md bg-secondary/40" />;
  if (candles.length < 5) return null;

  const W = 320, H = 96, P = 4;
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const minP = Math.min(...lows, entry);
  const maxP = Math.max(...highs, entry);
  const span = Math.max(0.0001, maxP - minP);
  const x = (i: number) => P + (i / (candles.length - 1)) * (W - 2 * P);
  const y = (p: number) => P + (1 - (p - minP) / span) * (H - 2 * P);

  // Detect consolidation / base on the most recent window: tight range = base
  const winN = Math.min(20, candles.length);
  const winStart = candles.length - winN;
  const winHighs = highs.slice(winStart);
  const winLows = lows.slice(winStart);
  const winHi = Math.max(...winHighs);
  const winLo = Math.min(...winLows);
  const winMid = (winHi + winLo) / 2;
  const rangePct = ((winHi - winLo) / winMid) * 100;
  const isBase = rangePct < 12; // tight range threshold

  const path = closes.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const area = `${path} L${x(closes.length - 1).toFixed(1)},${(H - P).toFixed(1)} L${x(0).toFixed(1)},${(H - P).toFixed(1)} Z`;
  const entryY = y(entry);

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible rounded-md bg-secondary/20">
        {isBase && (
          <>
            <rect
              x={x(winStart)}
              y={y(winHi)}
              width={x(candles.length - 1) - x(winStart)}
              height={Math.max(2, y(winLo) - y(winHi))}
              fill="hsl(var(--primary) / 0.12)"
              stroke="hsl(var(--primary) / 0.45)"
              strokeDasharray="3 2"
            />
            <text x={x(winStart) + 4} y={y(winHi) - 2} className="fill-primary" fontSize="9" fontFamily="monospace">
              base · {rangePct.toFixed(1)}%
            </text>
          </>
        )}
        <path d={area} fill="hsl(var(--primary) / 0.10)" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        {/* Entry line */}
        <line x1={P} x2={W - P} y1={entryY} y2={entryY} stroke="hsl(var(--success))" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - P - 2} y={entryY - 3} textAnchor="end" className="fill-success" fontSize="9" fontFamily="monospace">
          entry ₹{entry.toFixed(2)}
        </text>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{isBase ? "Consolidation detected" : "Trend leg"}</span>
        <span>last {candles.length}d</span>
      </div>
    </div>
  );
}
