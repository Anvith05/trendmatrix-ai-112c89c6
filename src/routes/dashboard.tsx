import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { agents, sectors, topRanked } from "@/lib/mockData";
import { Activity, TrendingUp, Layers, Radar } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard,
  head: () => ({ meta: [{ title: "Terminal · TrendMatrix AI" }] }),
});

function Dashboard() {
  const top = topRanked(15);
  const sortedSectors = [...sectors].sort((a, b) => b.syncScore - a.syncScore);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <Ticker />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Master Terminal</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Swing Intelligence Dashboard</h1>
          </div>
          <div className="hidden gap-2 md:flex">
            <span className="rounded-md glass px-3 py-1.5 text-xs font-mono text-muted-foreground">2,147 stocks scanned</span>
            <span className="rounded-md glass px-3 py-1.5 text-xs font-mono text-success">12 high-conviction</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { icon: TrendingUp, label: "Bullish Monthly Trends", val: "612", sub: "of 2,147 scanned" },
            { icon: Layers, label: "Weekly Consolidations", val: "198", sub: "tight bases detected" },
            { icon: Radar, label: "Synchronized Sectors", val: "5", sub: "rally-priming" },
            { icon: Activity, label: "Master Conviction", val: "12", sub: "high-probability setups" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl glass p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-gradient">{k.val}</div>
              <div className="text-[11px] text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Conviction list */}
          <div className="lg:col-span-2 overflow-hidden rounded-xl glass">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Master AI · Final Rankings</div>
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
                  <tr key={s.symbol} className="border-b border-border/40 hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono font-semibold">{s.symbol}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.sector}</td>
                    <td className="px-4 py-2 text-right font-mono">₹{s.ltp.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.monthlyScore}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.weeklyScore}</td>
                    <td className={`px-4 py-2 text-right font-mono ${s.rs >= 0 ? "text-success" : "text-destructive"}`}>{s.rs >= 0 ? "+" : ""}{s.rs}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.volumeAccum}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-gradient">{s.swingScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sector strip */}
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

        {/* Agent activity */}
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
                  <span>processed {a.processed}</span>
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
