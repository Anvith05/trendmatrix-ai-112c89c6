import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { getHealthBoard, type HealthRow } from "@/lib/macro.functions";

export const Route = createFileRoute("/health")({
  component: HealthPage,
  head: () => ({ meta: [
    { title: "Financial Health · TrendMatrix AI" },
    { name: "description", content: "Risk score per NSE stock from P/E, debt and profit trends, combined with price action." },
    { property: "og:title", content: "Financial Health · TrendMatrix AI" },
    { property: "og:description", content: "Each stock's financial risk score and whether it passes the pick filter." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
});

const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`);

function HealthPage() {
  const fn = useServerFn(getHealthBoard);
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  useEffect(() => { fn().then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Financial Health</h1>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Risk = 100 − financial score (profit, profit & sales growth, ROE, debt/equity, P/E from yearly results). A stock passes only if it's profitable, scores 50+, has debt ≤ 2× equity, trades above its 50-day average and turns over ₹10 Cr+/day.</p>
        {!rows && <div className="h-40 animate-pulse rounded-xl glass" />}
        {rows && (
          <div className="overflow-x-auto rounded-xl glass">
            <table className="w-full text-xs">
              <thead className="text-left font-mono uppercase text-muted-foreground">
                <tr>{["Stock", "Risk", "P/E", "Debt/Eq", "Profit YoY", "Sales YoY", "Price action", "Pick filter", "Details"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className="border-t border-border">
                    <td className="p-2"><div className="font-mono font-bold">{r.symbol}</div><div className="text-muted-foreground">{r.sector}</div></td>
                    <td className={`p-2 font-mono font-bold ${r.risk == null ? "" : r.risk <= 40 ? "text-success" : r.risk <= 55 ? "text-primary" : "text-destructive"}`}>{r.risk ?? "—"}</td>
                    <td className="p-2 font-mono">{r.pe?.toFixed(0) ?? "—"}</td>
                    <td className="p-2 font-mono">{r.de?.toFixed(2) ?? "—"}</td>
                    <td className="p-2 font-mono">{pct(r.profitGrowth)}</td>
                    <td className="p-2 font-mono">{pct(r.revenueGrowth)}</td>
                    <td className={`p-2 ${r.priceOk ? "text-success" : "text-muted-foreground"}`}>{r.priceOk ? "OK" : "Weak"}</td>
                    <td className={`p-2 font-semibold ${r.passes ? "text-success" : "text-destructive"}`}>{r.passes ? "Pass" : "Fail"}</td>
                    <td className="p-2 text-muted-foreground">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
