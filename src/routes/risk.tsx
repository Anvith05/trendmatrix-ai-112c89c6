import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { getRiskRadar, runRiskScan } from "@/lib/market.functions";
import {
  AlertTriangle, Loader2, RefreshCw, ShieldCheck, Globe2, Newspaper, LineChart, Landmark, Shield,
} from "lucide-react";

export const Route = createFileRoute("/risk")({
  component: RiskPage,
  head: () => ({
    meta: [
      { title: "Market Risk Radar · TrendMatrix AI" },
      { name: "description", content: "Continuous geopolitical, government-policy and market-news tracking that warns before broad NSE/BSE drawdowns, with reasons and protective actions." },
      { property: "og:title", content: "Market Risk Radar · TrendMatrix AI" },
      { property: "og:description", content: "AI tracks geopolitics, RBI/government policy and cross-asset stress to flag crash risk early — with reasons and what to do." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Driver = { title: string; impact?: string; why?: string };
type Action = { action: string; why?: string };
type Stat = { key: string; label: string; value: number | null; change_pct: number | null; vs_50dma_pct: number | null; drawdown_pct: number | null; note: string };
type Headline = { title: string; source: string; published: string; topic: string; link: string };
type Report = {
  id: string; created_at: string; risk_score: number; risk_level: string;
  headline: string; summary: string; drivers: Driver[]; actions: Action[];
  headlines: Headline[]; market: { stats?: Stat[] };
};

const LEVEL_STYLES: Record<string, { chip: string; ring: string; label: string }> = {
  low: { chip: "bg-success/15 text-success border-success/40", ring: "text-success", label: "Low risk" },
  elevated: { chip: "bg-warning/15 text-warning border-warning/40", ring: "text-warning", label: "Elevated risk" },
  high: { chip: "bg-destructive/15 text-destructive border-destructive/40", ring: "text-destructive", label: "High risk" },
  critical: { chip: "bg-destructive/25 text-destructive border-destructive", ring: "text-destructive", label: "Critical — protect capital" },
};

function fmtPct(n: number | null | undefined) {
  return n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function RiskPage() {
  const load = useServerFn(getRiskRadar);
  const scan = useServerFn(runRiskScan);

  const [latest, setLatest] = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [topic, setTopic] = useState<string>("all");
  const started = useRef(false);

  const refresh = useCallback(async () => {
    const r = (await load()) as any;
    setLatest(r.latest);
    setHistory(r.history ?? []);
  }, [load]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      await scan({ data: { source: "manual" } });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }, [scan, refresh]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Continuous tracking — auto re-scan every 15 minutes while the page is open,
  // and pull the newest server-side (cron) report every 60s.
  useEffect(() => {
    const poll = setInterval(() => { refresh(); }, 60_000);
    const rescan = setInterval(() => { runScan(); }, 15 * 60_000);
    return () => { clearInterval(poll); clearInterval(rescan); };
  }, [refresh, runScan]);

  const level = latest?.risk_level ?? "low";
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.low;
  const stats = latest?.market?.stats ?? [];
  const news = latest?.headlines ?? [];
  const topics = Array.from(new Set(news.map((n) => n.topic)));
  const visibleNews = topic === "all" ? news : news.filter((n) => n.topic === topic);

  return (
    <div className="min-h-screen">
      <SiteNav /><Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Continuous Macro Defence</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Market Risk Radar</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              The agents track geopolitics, Indian market news, RBI and government policy, commodities and global cross-asset
              stress around the clock. When something threatens the whole market, you get the warning, the reason, and what to do.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {latest && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Last scan {new Date(latest.created_at).toLocaleString()}
              </span>
            )}
            <button onClick={runScan} disabled={scanning}
              className="flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold !text-white glow disabled:opacity-60">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {scanning ? "Scanning news & markets…" : "Scan now"}
            </button>
          </div>
        </div>

        {loading && <div className="rounded-xl glass p-8 text-center text-muted-foreground">Loading risk radar…</div>}

        {!loading && !latest && (
          <div className="rounded-xl glass p-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warning" />
            <div className="text-sm text-muted-foreground">No risk scan yet. Hit “Scan now” to run the first sweep.</div>
          </div>
        )}

        {!loading && latest && (
          <>
            {/* Verdict */}
            <div className={`mb-6 rounded-xl border glass p-5 ${level === "low" ? "" : "border-destructive/40"}`}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-border">
                  <div className={`font-display text-2xl font-bold ${style.ring}`}>{latest.risk_score}</div>
                  <div className="text-[9px] font-mono uppercase text-muted-foreground">risk / 100</div>
                </div>
                <div className="min-w-[260px] flex-1">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase ${style.chip}`}>
                    {level === "low" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {style.label}
                  </span>
                  <h2 className="mt-2 font-display text-xl font-bold">{latest.headline}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{latest.summary}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Drivers — why */}
              <section className="rounded-xl glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide">Why — risk drivers</h3>
                </div>
                <ul className="space-y-3">
                  {(latest.drivers ?? []).map((d, i) => (
                    <li key={i} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{d.title}</span>
                        {d.impact && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${
                            d.impact === "high" ? "bg-destructive/15 text-destructive"
                            : d.impact === "medium" ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground"}`}>{d.impact}</span>
                        )}
                      </div>
                      {d.why && <p className="mt-1 text-xs text-muted-foreground">{d.why}</p>}
                    </li>
                  ))}
                  {!(latest.drivers ?? []).length && <li className="text-xs text-muted-foreground">No active risk drivers.</li>}
                </ul>
              </section>

              {/* Actions — solution */}
              <section className="rounded-xl glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" />
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide">Solution — protect the book</h3>
                </div>
                <ul className="space-y-3">
                  {(latest.actions ?? []).map((a, i) => (
                    <li key={i} className="rounded-lg border border-success/30 bg-success/5 p-3">
                      <div className="text-sm font-semibold">{a.action}</div>
                      {a.why && <p className="mt-1 text-xs text-muted-foreground">{a.why}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Telemetry */}
            <section className="mt-4 rounded-xl glass p-5">
              <div className="mb-3 flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide">Cross-asset stress monitor</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.map((s) => (
                  <div key={s.key} className="rounded-lg border border-border/60 p-3">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">{s.label}</div>
                    <div className="font-display text-lg font-bold">{s.value ?? "—"}</div>
                    <div className={`font-mono text-xs ${(s.change_pct ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmtPct(s.change_pct)}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {s.note} · {fmtPct(s.drawdown_pct)} from 52w high
                    </div>
                  </div>
                ))}
                {!stats.length && <div className="text-xs text-muted-foreground">No telemetry captured in this scan.</div>}
              </div>
            </section>

            {/* News */}
            <section className="mt-4 rounded-xl glass p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide">Tracked news feed</h3>
                <div className="ml-auto flex flex-wrap gap-1">
                  {["all", ...topics].map((t) => (
                    <button key={t} onClick={() => setTopic(t)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase ${topic === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-border/60">
                {visibleNews.map((n, i) => (
                  <li key={i} className="py-2">
                    <a href={n.link} target="_blank" rel="noreferrer" className="text-sm hover:text-primary">
                      {n.title}
                    </a>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      {n.topic} · {n.source} · {n.published ? new Date(n.published).toLocaleString() : ""}
                    </div>
                  </li>
                ))}
                {!visibleNews.length && <li className="py-3 text-xs text-muted-foreground">No headlines captured.</li>}
              </ul>
            </section>

            {/* History */}
            <section className="mt-4 rounded-xl glass p-5">
              <div className="mb-3 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide">Risk history</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-mono uppercase text-muted-foreground">
                    <tr><th className="py-2">When</th><th className="py-2">Score</th><th className="py-2">Level</th><th className="py-2">Verdict</th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-border/60">
                        <td className="py-2 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</td>
                        <td className="py-2 font-mono">{h.risk_score}</td>
                        <td className="py-2 text-xs uppercase">{h.risk_level}</td>
                        <td className="py-2 text-xs text-muted-foreground">{h.headline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
