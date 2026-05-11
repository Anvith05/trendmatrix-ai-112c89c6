import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { sectors } from "@/lib/mockData";

export const Route = createFileRoute("/sectors/")({ component: SectorsPage,
  head: () => ({ meta: [{ title: "Sector Heatmap · TrendMatrix AI" }] }),
});

function SectorsPage() {
  const sorted = [...sectors].sort((a, b) => b.syncScore - a.syncScore);
  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Sector Synchronization Heatmap</div>
          <h1 className="mt-1 font-display text-3xl font-bold">Where the next rally is brewing</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Color intensity = sector sync score. Click any sector to see the live "basing list" of consolidating stocks.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {sorted.map((s) => {
            const intensity = Math.min(1, s.syncScore / 100);
            return (
              <Link to="/sectors/$sectorId" params={{ sectorId: s.id }} key={s.id}
                className="group rounded-xl border border-border p-5 transition hover:scale-[1.02] hover:border-primary/40"
                style={{ background: `linear-gradient(135deg, oklch(0.78 0.18 195 / ${intensity * 0.30}), oklch(0.70 0.22 295 / ${intensity * 0.20}))` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-semibold">{s.name}</div>
                    <div className="mt-1 text-[11px] font-mono text-muted-foreground">Monthly trend {s.monthlyTrend} · RS {s.rs >= 0 ? "+" : ""}{s.rs}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-3xl font-bold text-gradient">{s.syncScore}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">sync</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.basingCount}/{s.totalStocks} basing on weekly</span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">View basing list →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
