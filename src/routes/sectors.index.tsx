import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { sectors as MOCK_SECTORS } from "@/lib/mockData";
import { getSectorHeatmap } from "@/lib/market.functions";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/sectors/")({
  component: SectorsPage,
  head: () => ({
    meta: [
      { title: "Live Sector Heatmap · TrendMatrix AI" },
      { name: "description", content: "Real-time NSE/BSE sector sync scores from the TrendMatrix AI agent pipeline — see which sector is priming for the next rally." },
      { property: "og:title", content: "Live Sector Heatmap · TrendMatrix AI" },
      { property: "og:description", content: "Real-time sector sync scores and basing lists across NSE/BSE sectors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SectorsPage() {
  const fetchHeatmap = useServerFn(getSectorHeatmap);
  const { data, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["sector-heatmap"],
    queryFn: () => fetchHeatmap(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const live = data?.sectors ?? [];
  const sorted = live.length ? live : [...MOCK_SECTORS].sort((a, b) => b.syncScore - a.syncScore);
  const isLive = live.length > 0;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Sector Synchronization Heatmap</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Where the next rally is brewing</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Color intensity = live sector sync score computed by the Sector AI agent. Click any sector to see its real-time basing list.
            </p>
          </div>
          <div className="text-right text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center justify-end gap-2">
              <span className={`h-2 w-2 rounded-full ${isLive ? "bg-success" : "bg-muted-foreground"}`} />
              {isLive ? "LIVE agent run" : "Seed data (awaiting first run)"}
            </div>
            <div className="mt-1">
              {data?.run?.finished_at ? `Run ${new Date(data.run.finished_at).toLocaleTimeString()}` : ""}
              {dataUpdatedAt ? ` · synced ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}
            </div>
            <button
              onClick={() => refetch()}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 uppercase tracking-wider transition hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
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
