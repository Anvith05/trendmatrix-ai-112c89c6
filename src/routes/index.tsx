import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { sectors, topRanked, agents } from "@/lib/mockData";
import { ArrowRight, Brain, LineChart, Layers, Radar, Sparkles, Zap, Activity, Cpu } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing,
  head: () => ({
    meta: [
      { title: "TrendMatrix AI — Indian Swing Trading Intelligence" },
      { name: "description", content: "Multi-agent AI platform combining monthly trend analysis, weekly consolidation intelligence, and sector-wide accumulation detection for Indian swing trading." },
    ],
  }),
});

function Landing() {
  const top = topRanked(6);
  const hotSectors = [...sectors].sort((a, b) => b.syncScore - a.syncScore).slice(0, 6);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <Ticker />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-mono text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              8 autonomous agents · scanning 2,147 NSE/BSE stocks live
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              AI Agents Detecting India's Next{" "}
              <span className="text-gradient">Sector-Wide Breakout</span>{" "}
              Before The Rally Starts.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              Institutional-grade multi-agent intelligence combining monthly trend analysis,
              weekly consolidation detection, sector-wide accumulation, historical pattern learning,
              and macro-economic context — purpose-built for high-conviction Indian swing trading.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/dashboard" className="group inline-flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02]">
                Open Terminal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link to="/training" className="inline-flex items-center gap-2 rounded-md glass px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary">
                <Brain className="h-4 w-4" /> Train the AI
              </Link>
            </div>
          </div>

          {/* Agent flow viz */}
          <div className="mt-16 glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <Cpu className="h-4 w-4 text-primary" /> LIVE AGENT WORKFLOW
              </div>
              <div className="text-xs font-mono text-muted-foreground">refreshed every 60s</div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
              {agents.map((a, i) => (
                <div key={a.id} className="relative rounded-lg glass p-3 text-center animate-float" style={{ animationDelay: `${i * 0.2}s` }}>
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--gradient-primary)] animate-pulse-ring">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{a.id}</div>
                  <div className="mt-1 text-xs font-semibold leading-tight">{a.name.replace(" AI", "")}</div>
                  <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>in {a.processed}</span>
                    <span className="text-primary">→ {a.accepted}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-10 max-w-2xl">
          <div className="mb-2 text-xs font-mono uppercase tracking-wider text-primary">Core Philosophy</div>
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Strong monthly trend + clean weekly base + sector synchronization = high probability swing.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: LineChart, title: "Monthly Trend Verification", text: "Identify multi-year structures with higher highs, institutional accumulation and macro confirmation." },
            { icon: Layers, title: "Weekly Consolidation Detection", text: "Tight ranges, volatility contraction, volume dry-up and compression zones before expansion." },
            { icon: Radar, title: "Sector-Wide Accumulation", text: "When 40-50% of a sector consolidates together with bullish monthly trends — a major rally is brewing." },
          ].map((c) => (
            <div key={c.title} className="group rounded-xl glass p-6 transition hover:border-primary/40">
              <c.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HEATMAP PREVIEW */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Sector Sync Heatmap</div>
            <h2 className="mt-1 font-display text-2xl font-bold">Hottest synchronized sectors right now</h2>
          </div>
          <Link to="/sectors" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {hotSectors.map((s) => {
            const intensity = Math.min(1, s.syncScore / 100);
            return (
              <Link to="/sectors/$sectorId" params={{ sectorId: s.id }} key={s.id}
                className="group rounded-xl border border-border p-4 transition hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, oklch(0.78 0.18 195 / ${intensity * 0.25}), oklch(0.70 0.22 295 / ${intensity * 0.18}))` }}>
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="mt-3 font-mono text-2xl font-bold text-gradient">{s.syncScore}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.basingCount}/{s.totalStocks} basing on weekly</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* TOP RANKED */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Master AI Conviction</div>
            <h2 className="mt-1 font-display text-2xl font-bold">Top swing setups passing every agent</h2>
          </div>
          <Link to="/dashboard" className="text-sm text-primary hover:underline">Full terminal →</Link>
        </div>
        <div className="overflow-hidden rounded-xl glass">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card/40 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3 text-right">Weekly</th>
                <th className="px-4 py-3 text-right">RS</th>
                <th className="px-4 py-3 text-right">Swing</th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.symbol} className="border-b border-border/50 transition hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono font-semibold">{s.symbol}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sector}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.monthlyScore}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.weeklyScore}</td>
                  <td className={`px-4 py-3 text-right font-mono ${s.rs >= 0 ? "text-success" : "text-destructive"}`}>{s.rs >= 0 ? "+" : ""}{s.rs}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gradient">{s.swingScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-primary" /> TrendMatrix AI · For swing & positional trading on NSE/BSE</div>
          <div className="font-mono">v0.1 · Powered by Lovable Cloud</div>
        </div>
      </footer>
    </div>
  );
}
