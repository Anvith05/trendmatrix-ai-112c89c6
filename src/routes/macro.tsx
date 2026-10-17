import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { MacroRegimeCard } from "@/components/MacroRegimeCard";
import { getCrashWatchlist, getMacroRegime, type WatchItem } from "@/lib/macro.functions";

export const Route = createFileRoute("/macro")({
  component: MacroPage,
  head: () => ({ meta: [
    { title: "Macro Radar & Crash Watchlist · TrendMatrix AI" },
    { name: "description", content: "Global crash radar and a shopping list of quality Indian stocks to buy at peak fear." },
    { property: "og:title", content: "Macro Radar · TrendMatrix AI" },
    { property: "og:description", content: "Global risk radar and crash shopping watchlist for Indian stocks." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
});

const ZONE: Record<string, string> = { deep_value: "Deep value — deploy", buy_zone: "Buy zone — scale in", wait: "Wait", "n/a": "n/a" };

function MacroPage() {
  const watchFn = useServerFn(getCrashWatchlist);
  const regimeFn = useServerFn(getMacroRegime);
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [regime, setRegime] = useState<string | null>(null);
  useEffect(() => {
    watchFn().then(setItems).catch(() => setItems([]));
    regimeFn({ data: {} }).then((r) => setRegime(r.regime)).catch(() => {});
  }, []);
  const armed = regime === "caution" || regime === "crash_watch";
  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <MacroRegimeCard full />
        {regime && !armed && (
          <div className="rounded-xl glass p-4 text-sm text-muted-foreground">No crash signals right now (radar is Risk-On), so no crash-shelter picks are shown.</div>
        )}
        {armed && <section>
          <h2 className="font-display text-lg font-semibold">Crash Shelter Picks</h2>
          <p className="mb-3 text-xs text-muted-foreground">Crash signals active. Up to 4 stocks or ETFs (like gold) that on average went UP on days Nifty fell over 1%, ranked live. Not a guarantee.</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items?.length === 0 && <div className="text-sm text-muted-foreground">Nothing in the list rose on fall days recently.</div>}
            {(items ?? []).map((w) => (
              <div key={w.symbol} className="rounded-xl glass p-4 border-success/50">
                <div className="flex justify-between"><span className="font-mono font-bold">{w.symbol}</span>
                  <span className="font-mono text-sm">{w.ltp != null ? `₹${w.ltp.toFixed(2)}` : "—"}</span></div>
                <div className="text-xs text-muted-foreground">{w.name} · {w.why}</div>
                <div className="mt-2 flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{w.drawdown != null ? `${w.drawdown.toFixed(1)}% from high` : ""}</span>
                  <span className="text-primary">{ZONE[w.zone]}</span>
                </div>
              </div>
            ))}
            {!items && <div className="h-24 animate-pulse rounded-xl glass" />}
          </div>
        </section>}
      </div>
    </div>
  );
}
