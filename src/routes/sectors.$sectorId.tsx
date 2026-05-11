import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { sectors, stocksForSector } from "@/lib/mockData";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/sectors/$sectorId")({
  component: SectorDetail,
  head: ({ params }) => ({ meta: [{ title: `${params.sectorId} sector · TrendMatrix AI` }] }),
});

function SectorDetail() {
  const { sectorId } = Route.useParams();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) throw notFound();

  const stocks = stocksForSector(sectorId).sort((a, b) => b.swingScore - a.swingScore);
  const basing = stocks.filter((s) => s.status === "basing" || s.status === "breaking_out");

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
              <div className="text-xs font-mono uppercase tracking-wider text-primary">Sector intelligence</div>
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
                  <div className="font-mono text-2xl font-bold text-gradient">{v}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl glass">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">All companies in {sector.name}</div>
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
                {stocks.map((s) => (
                  <tr key={s.symbol} className="border-b border-border/40 hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono font-semibold">{s.symbol}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono">₹{s.ltp.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.monthlyScore}/{s.weeklyScore}</td>
                    <td className={`px-4 py-2 text-right font-mono ${s.rs >= 0 ? "text-success" : "text-destructive"}`}>{s.rs >= 0 ? "+" : ""}{s.rs}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-gradient">{s.swingScore}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${
                        s.status === "breaking_out" ? "border border-success/40 bg-success/10 text-success" :
                        s.status === "basing" ? "border border-primary/40 bg-primary/10 text-primary" :
                        "border border-border text-muted-foreground"
                      }`}>{s.status.replace("_", " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl glass p-4">
            <div className="text-sm font-semibold">Basing list ({basing.length})</div>
            <p className="mt-1 text-xs text-muted-foreground">Stocks currently consolidating on weekly with bullish monthly trend.</p>
            <div className="mt-3 space-y-2">
              {basing.map((s) => (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
