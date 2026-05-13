import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { getCategoryStocks, getLatestRankings, runAgents } from "@/lib/market.functions";
import { agents, sectors } from "@/lib/mockData";
import { Activity, TrendingUp, Layers, Radar, RefreshCw, Loader2, X, Eye } from "lucide-react";

type Cat = "bullish_monthly" | "weekly_consolidation" | "synced_sector" | "high_conviction";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Terminal · TrendMatrix AI" }] }),
});

function Dashboard() {
  const fetchRankings = useServerFn(getLatestRankings);
  const trigger = useServerFn(runAgents);
  const fetchCategory = useServerFn(getCategoryStocks);
  const [data, setData] = useState<{ run: any; rankings: any[] }>({ run: null, rankings: [] });
  const [busy, setBusy] = useState(false);
  const [openCat, setOpenCat] = useState<Cat | null>(null);
  const [catRows, setCatRows] = useState<any[] | null>(null);

  async function load() {
    const r = await fetchRankings({});
    setData(r as any);
  }
  useEffect(() => { load(); }, []);

  async function refresh() {
    setBusy(true);
    try { await trigger({ data: { source: "manual" } }); await load(); }
    finally { setBusy(false); }
  }

  async function openCategory(cat: Cat) {
    setOpenCat(cat); setCatRows(null);
    const rows = await fetchCategory({ data: { category: cat } });
    setCatRows(rows as any[]);
  }

  const top = data.rankings.slice(0, 15);
  const sortedSectors = [...sectors].sort((a, b) => b.syncScore - a.syncScore);
  const bullishMonthly = data.rankings.filter((r) => r.monthly_score >= 65).length;
  const tightWeekly = data.rankings.filter((r) => r.weekly_score >= 70).length;
  const highConv = data.rankings.filter((r) => r.swing_score >= 70).length;
  const syncSectors = new Set(data.rankings.filter((r) => r.sector_score >= 70).map((r) => r.sector)).size;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Master Terminal</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Swing Intelligence Dashboard</h1>
            {data.run && (
              <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                last run · {new Date(data.run.finished_at ?? data.run.started_at).toLocaleString()} · {data.run.ranked} stocks ranked
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <span className="hidden md:inline rounded-md glass px-3 py-1.5 text-xs font-mono text-muted-foreground">{data.rankings.length} stocks scanned</span>
            <span className="hidden md:inline rounded-md glass px-3 py-1.5 text-xs font-mono text-success">{highConv} high-conviction</span>
            <button onClick={refresh} disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold text-primary-foreground glow disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Run agents
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {([
            { cat: "bullish_monthly" as Cat,      icon: TrendingUp, label: "Bullish Monthly Trends", val: bullishMonthly, sub: `monthly score \u2265 65 \u00b7 of ${data.rankings.length} scanned` },
            { cat: "weekly_consolidation" as Cat, icon: Layers,     label: "Weekly Consolidations", val: tightWeekly,     sub: "weekly score \u2265 70 (tight base)" },
            { cat: "synced_sector" as Cat,        icon: Radar,      label: "Synchronized Sectors", val: syncSectors,      sub: "sector score \u2265 70" },
            { cat: "high_conviction" as Cat,      icon: Activity,   label: "Top Picks Eligible",   val: highConv,         sub: `swing \u2265 70 = top-pick threshold` },
          ]).map((k) => (
            <button key={k.label} onClick={() => openCategory(k.cat)}
              className="group rounded-xl glass p-4 text-left transition hover:border-primary/60">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-gradient">{k.val}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{k.sub}</span>
                <span className="flex items-center gap-1 text-primary opacity-0 transition group-hover:opacity-100"><Eye className="h-3 w-3" /> view</span>
              </div>
            </button>
          ))}
        </div>

        {openCat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={() => setOpenCat(null)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-xs font-mono uppercase text-primary">{openCat.replace(/_/g, " ")}</div>
                  <div className="text-sm font-semibold">{catRows ? `${catRows.length} stocks selected` : "Loading…"}</div>
                </div>
                <button onClick={() => setOpenCat(null)} className="rounded-md p-2 text-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[68vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-[11px] font-mono uppercase text-muted-foreground">
                    <tr><th className="px-4 py-2 text-left">Symbol</th><th className="px-4 py-2 text-left">Sector</th>
                      <th className="px-4 py-2 text-right">M</th><th className="px-4 py-2 text-right">W</th>
                      <th className="px-4 py-2 text-right">Sec</th><th className="px-4 py-2 text-right">Swing</th></tr>
                  </thead>
                  <tbody>
                    {(catRows ?? []).map((r) => (
                      <tr key={r.id} className="border-t border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-2 font-mono font-semibold">{r.symbol}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{r.sector}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.monthly_score}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.weekly_score}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.sector_score}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-gradient">{r.swing_score}</td>
                      </tr>
                    ))}
                    {catRows && catRows.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No stocks in this bucket from the latest scan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl glass">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Master AI · Live Rankings</div>
            {top.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No rankings yet. Click <span className="font-semibold text-primary">Run agents</span> to scan the live NSE/BSE feed.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-card/40 text-xs font-mono uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Symbol</th>
                    <th className="px-4 py-2 text-left">Sector</th>
                    <th className="px-4 py-2 text-right">LTP</th>
                    <th className="px-4 py-2 text-right">M</th>
                    <th className="px-4 py-2 text-right">W</th>
                    <th className="px-4 py-2 text-right">RS</th>
                    <th className="px-4 py-2 text-right">Vol</th>
                    <th className="px-4 py-2 text-right">Swing</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/40">
                      <td className="px-4 py-2 font-mono font-semibold">
                        <Link to="/research" search={{}} className="hover:text-primary">{s.symbol}</Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{s.sector}</td>
                      <td className="px-4 py-2 text-right font-mono">₹{Number(s.ltp).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.monthly_score}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.weekly_score}</td>
                      <td className={`px-4 py-2 text-right font-mono ${s.rs_score >= 50 ? "text-success" : "text-destructive"}`}>{s.rs_score}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.volume_score}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-gradient">{s.swing_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl glass p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold">Sector Sync Score</span>
              <Link to="/sectors" className="text-xs text-primary hover:underline">All →</Link>
            </div>
            <div className="space-y-2">
              {sortedSectors.map((s) => (
                <Link to="/sectors/$sectorId" params={{ sectorId: s.id }} key={s.id} className="block">
                  <div className="flex items-center justify-between text-xs">
                    <span>{s.name}</span>
                    <span className="font-mono text-muted-foreground">{s.basingCount}/{s.totalStocks} basing</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-[var(--gradient-primary)]" style={{ width: `${s.syncScore}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl glass p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold">Live Agent Activity</span>
            <Link to="/agents" className="text-xs text-primary hover:underline">Open agent flow →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {agents.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{a.name}</span>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-[11px] font-mono text-muted-foreground">
                  <span>processed {data.rankings.length || a.processed}</span>
                  <span className="text-primary">accepted {a.accepted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
