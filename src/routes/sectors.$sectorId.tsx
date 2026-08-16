import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { sectors as MOCK_SECTORS, stocksForSector } from "@/lib/mockData";
import { getSectorDetail } from "@/lib/market.functions";
import { ArrowLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/sectors/$sectorId")({
  component: SectorDetail,
  head: ({ params }) => ({
    meta: [
      { title: `${params.sectorId} sector intelligence · TrendMatrix AI` },
      { name: "description", content: `Live agent scores, basing list and swing setups for the ${params.sectorId} sector on NSE/BSE.` },
      { property: "og:title", content: `${params.sectorId} sector · TrendMatrix AI` },
      { property: "og:description", content: `Real-time sector sync, monthly trend and weekly basing list for ${params.sectorId}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SectorDetail() {
  const { sectorId } = Route.useParams();
  const fetchDetail = useServerFn(getSectorDetail);
  const { data, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["sector-detail", sectorId],
    queryFn: () => fetchDetail({ data: { sectorId } }),
    refetchInterval: 60_000,
  });

  const mockSector = MOCK_SECTORS.find((s) => s.id === sectorId);
  const sector = data?.sector ?? mockSector ?? null;
  const isLive = Boolean(data?.sector);
  const stocks = isLive
    ? (data!.stocks as any[])
    : stocksForSector(sectorId).sort((a, b) => b.swingScore - a.swingScore);

  if (!sector) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Sector not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This sector has no data in the latest agent run yet.</p>
          <Link to="/sectors" className="mt-4 inline-block text-sm text-primary">← All sectors</Link>
        </div>
      </div>
    );
  }

  const basing = stocks.filter((s: any) => s.weeklyScore >= 65 && s.monthlyScore >= 60 || s.status === "basing" || s.status === "breaking_out");

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link to="/sectors" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3 w-3" /> All sectors
        </Link>

        <div className="rounded-2xl glass p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
                Sector intelligence
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-success" : "bg-muted-foreground"}`} />
                <span className="text-muted-foreground">{isLive ? "live" : "seed"}</span>
                <button onClick={() => refetch()} className="inline-flex items-center gap-1 normal-case text-muted-foreground hover:text-foreground">
                  <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
                  {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : ""}
                </button>
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold">{sector.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sector.basingCount} of {sector.totalStocks} stocks basing on weekly · monthly trend {sector.monthlyTrend} · RS {sector.rs >= 0 ? "+" : ""}{sector.rs}
              </p>
            </div>
            <div className="flex gap-3">
              {[
                ["Sync", sector.syncScore],
                ["Monthly", sector.monthlyTrend],
                ["Weekly base", sector.weeklyConsolidation],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-border px-4 py-3 text-center">
                  <div className="font-mono text-2xl font-bold text-gradient">{v as number}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{l as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl glass">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">All instruments in {sector.name}</div>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card/40 text-xs font-mono uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Symbol</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">LTP</th>
                  <th className="px-4 py-2 text-right">M / W</th>
                  <th className="px-4 py-2 text-right">RS</th>
                  <th className="px-4 py-2 text-right">Swing</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s: any) => (
                  <tr key={s.symbol} className="border-b border-border/40 hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono font-semibold">
                      {s.symbol}
                      {s.kind === "etf" && <span className="ml-2 rounded border border-border px-1 text-[9px] font-mono uppercase text-muted-foreground">ETF</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono">₹{Number(s.ltp).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.monthlyScore}/{s.weeklyScore}</td>
                    <td className={`px-4 py-2 text-right font-mono ${s.rs >= 0 ? "text-success" : "text-destructive"}`}>{s.rs >= 0 ? "+" : ""}{s.rs}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-gradient">{s.swingScore}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${
                        s.status === "breaking_out" ? "border border-success/40 bg-success/10 text-success" :
                        s.status === "basing" ? "border border-primary/40 bg-primary/10 text-primary" :
                        "border border-border text-muted-foreground"
                      }`}>{String(s.status).replace("_", " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl glass p-4">
            <div className="text-sm font-semibold">Basing list ({basing.length})</div>
            <p className="mt-1 text-xs text-muted-foreground">Consolidating on weekly with a bullish monthly trend — refreshed every minute.</p>
            <div className="mt-3 space-y-2">
              {basing.map((s: any) => (
                <div key={s.symbol} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                  <div>
                    <div className="font-mono font-semibold">{s.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{s.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-gradient">{s.swingScore}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">M{s.monthlyScore}·W{s.weeklyScore}</div>
                  </div>
                </div>
              ))}
              {!basing.length && <div className="text-xs text-muted-foreground">No stocks basing right now.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
