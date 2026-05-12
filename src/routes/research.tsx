import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { getQuote, searchUniverse } from "@/lib/market.functions";
import { extractTrainingFeatures } from "@/lib/training.functions";
import { supabase } from "@/integrations/supabase/client";
import { Search, TrendingUp, TrendingDown, Activity, Loader2, Upload, Brain, Sparkles } from "lucide-react";

export const Route = createFileRoute("/research")({
  component: Research,
  head: () => ({ meta: [{ title: "Research · TrendMatrix AI" }, { name: "description", content: "Live NSE/BSE price + 8-agent AI analytics for any Indian stock." }] }),
});

const AGENT_LABELS: [string, string][] = [
  ["monthly", "Monthly Trend"],
  ["weekly", "Weekly Consolidation"],
  ["sector", "Sector Sync"],
  ["history", "Historical Pattern"],
  ["fundamental", "Fundamental"],
  ["macro", "Macro / Regime"],
  ["rs", "Relative Strength"],
  ["volume", "Volume Accumulation"],
];

type Quote = Awaited<ReturnType<typeof getQuote>>;
type Match = { id: string; image_path: string; label: string; note: string | null; tags: string[] | null };

function Sparkline({ candles }: { candles: { t: number; c: number }[] }) {
  const w = 600, h = 160, pad = 4;
  const xs = candles.map((_, i) => (i / (candles.length - 1)) * (w - pad * 2) + pad);
  const ys = candles.map((c) => c.c);
  const min = Math.min(...ys), max = Math.max(...ys);
  const norm = ys.map((y) => h - pad - ((y - min) / (max - min || 1)) * (h - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${norm[i].toFixed(1)}`).join(" ");
  const last = candles[candles.length - 1];
  const first = candles[0];
  const up = last.c >= first.c;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity="0.35" />
          <stop offset="100%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w - pad},${h} L${pad},${h} Z`} fill="url(#g)" />
      <path d={path} fill="none" stroke={up ? "hsl(var(--success))" : "hsl(var(--destructive))"} strokeWidth="1.5" />
    </svg>
  );
}

function Research() {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string; sector: string }[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const fetchQuote = useServerFn(getQuote);
  const search = useServerFn(searchUniverse);
  const extract = useServerFn(extractTrainingFeatures);

  // Teach-AI uploader state (scoped to currently-loaded stock)
  const [teachFile, setTeachFile] = useState<File | null>(null);
  const [teachPreview, setTeachPreview] = useState<string | null>(null);
  const [teachLabel, setTeachLabel] = useState("successful_breakout");
  const [teachNote, setTeachNote] = useState("");
  const [teachBusy, setTeachBusy] = useState(false);
  const [teachMsg, setTeachMsg] = useState<string | null>(null);
  const teachFileRef = useRef<HTMLInputElement>(null);

  function pickTeachFile(f: File | null) {
    setTeachFile(f);
    setTeachPreview(f ? URL.createObjectURL(f) : null);
  }

  async function teachAI() {
    if (!teachFile || !quote) return;
    setTeachBusy(true); setTeachMsg(null);
    try {
      const ext = teachFile.name.split(".").pop() ?? "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("training-charts").upload(path, teachFile, { contentType: teachFile.type });
      if (up.error) throw up.error;
      const ins = await supabase.from("training_examples").insert({
        image_path: path, label: teachLabel,
        note: teachNote || null,
        symbol: quote.symbol, sector: quote.sector,
      }).select().single();
      if (ins.error) throw ins.error;
      setTeachMsg("Saved · AI is reading the chart…");
      try {
        await extract({ data: { id: ins.data.id } });
        setTeachMsg("✓ Indexed — pattern-matching agent now uses this example.");
      } catch (e: any) {
        setTeachMsg(`Saved (vision extract failed: ${e?.message ?? e})`);
      }
      setTeachFile(null); setTeachPreview(null); setTeachNote("");
      if (teachFileRef.current) teachFileRef.current.value = "";
    } catch (e: any) {
      setTeachMsg(e?.message ?? "Upload failed");
    } finally {
      setTeachBusy(false);
    }
  }


  useEffect(() => {
    let active = true;
    if (q.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const r = await search({ data: { q } });
      if (active) setSuggestions(r);
    }, 150);
    return () => { active = false; clearTimeout(t); };
  }, [q, search]);

  async function lookup(symbol: string) {
    setLoading(true); setError(null); setSuggestions([]); setQ(symbol);
    try {
      const data = await fetchQuote({ data: { symbol } });
      setQuote(data);
      // Find similar training examples via tag overlap
      const { data: examples } = await supabase.from("training_examples").select("id, image_path, label, note, tags");
      const ranked = (examples ?? []).map((e: any) => {
        const overlap = (e.tags ?? []).filter((t: string) => data.tags.includes(t.toLowerCase())).length;
        return { ...e, overlap };
      }).filter((e: any) => e.overlap > 0).sort((a: any, b: any) => b.overlap - a.overlap).slice(0, 4);
      setMatches(ranked);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setQuote(null);
    } finally { setLoading(false); }
  }

  const up = (quote?.change_pct ?? 0) >= 0;

  return (
    <div className="min-h-screen">
      <SiteNav /><Ticker />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Research Terminal</div>
          <h1 className="mt-1 font-display text-3xl font-bold">Search any NSE/BSE stock</h1>
        </div>

        <div className="relative mb-6">
          <div className="flex items-center gap-2 rounded-xl glass px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && q) lookup(q.toUpperCase()); }}
              placeholder="HAL, RELIANCE, TCS, IRCTC…"
              className="flex-1 bg-transparent font-mono text-base outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => q && lookup(q.toUpperCase())}
              className="rounded-md bg-[var(--gradient-primary)] px-4 py-1.5 text-sm font-semibold text-primary-foreground glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              {suggestions.map((s) => (
                <button key={s.symbol} onClick={() => lookup(s.symbol)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary">
                  <span><span className="font-mono font-semibold">{s.symbol}</span> · <span className="text-muted-foreground">{s.name}</span></span>
                  <span className="text-[11px] text-muted-foreground">{s.sector}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {!quote && !loading && (
          <div className="rounded-xl glass p-12 text-center text-sm text-muted-foreground">
            Search any Indian stock to see live price + scores from all 8 AI agents + matched training examples.
          </div>
        )}

        {quote && (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl glass p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold">{quote.name}</h2>
                    <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">{quote.symbol}</span>
                    <span className="text-xs text-muted-foreground">{quote.sector}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono text-3xl font-bold">₹{quote.ltp.toFixed(2)}</span>
                    <span className={`flex items-center gap-1 font-mono text-sm ${up ? "text-success" : "text-destructive"}`}>
                      {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {up ? "+" : ""}{quote.change_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground sm:grid-cols-4">
                  <div>Day H<div className="text-foreground">₹{quote.day_high?.toFixed(2)}</div></div>
                  <div>Day L<div className="text-foreground">₹{quote.day_low?.toFixed(2)}</div></div>
                  <div>52w H<div className="text-foreground">₹{quote.fifty_two_high?.toFixed(2)}</div></div>
                  <div>52w L<div className="text-foreground">₹{quote.fifty_two_low?.toFixed(2)}</div></div>
                </div>
              </div>
              <div className="mt-4">
                <Sparkline candles={quote.candles} />
              </div>
            </div>

            {/* Master conviction */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl glass p-5 lg:col-span-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Master Swing Conviction</div>
                <div className="mt-2 font-mono text-6xl font-bold text-gradient">{quote.scores.swing}</div>
                <div className="mt-1 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                    quote.scores.status === "breaking_out" ? "bg-success/15 text-success" :
                    quote.scores.status === "basing" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>{quote.scores.status.replace("_", " ")}</span>
                </div>
                {quote.tags.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">Detected pattern tags</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                {quote.tags.map((t: string) => (
                      <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">{t}</span>
                    ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl glass p-5 lg:col-span-2">
                <div className="mb-3 text-sm font-semibold">8-Agent Breakdown</div>
                <div className="space-y-2">
                  {AGENT_LABELS.map(([k, label]) => {
                    const v = (quote.scores as any)[k] as number;
                    return (
                      <div key={k}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{label}</span>
                          <span className="font-mono font-semibold">{v}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-[var(--gradient-primary)]" style={{ width: `${v}%` }} />
                        </div>
                        {(quote.scores.reasoning as any)?.[k] && (
                          <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">{(quote.scores.reasoning as any)[k]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Teach AI from this stock */}
            <div className="rounded-xl glass p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Brain className="h-4 w-4 text-primary" />
                Teach the AI a pattern from {quote.symbol}
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                See a clean setup on this chart? Upload a screenshot and the AI will extract its features and add it to your training library — every future scan will compare stocks against it.
              </p>
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/40 transition hover:border-primary/60">
                  {teachPreview ? (
                    <img src={teachPreview} alt="preview" className="h-full w-full rounded-lg object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                      <div className="mt-1 text-[11px] text-muted-foreground">Chart screenshot</div>
                    </div>
                  )}
                  <input ref={teachFileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => pickTeachFile(e.target.files?.[0] ?? null)} />
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground">Label</label>
                      <select value={teachLabel} onChange={(e) => setTeachLabel(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                        <option value="successful_breakout">Successful breakout</option>
                        <option value="failed_breakout">Failed breakout</option>
                        <option value="accumulation">Accumulation</option>
                        <option value="weekly_consolidation">Weekly consolidation</option>
                        <option value="momentum_expansion">Momentum expansion</option>
                        <option value="sector_rally">Sector rally</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground">Auto-tagged</label>
                      <div className="mt-1 truncate rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {quote.symbol} · {quote.sector}
                      </div>
                    </div>
                  </div>
                  <textarea value={teachNote} onChange={(e) => setTeachNote(e.target.value)} rows={2}
                    placeholder="Note for the AI: what makes this setup interesting?"
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs" />
                  <div className="flex items-center gap-3">
                    <button onClick={teachAI} disabled={teachBusy || !teachFile}
                      className="inline-flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold text-primary-foreground glow disabled:opacity-50">
                      {teachBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {teachBusy ? "Saving…" : "Teach the AI"}
                    </button>
                    {teachMsg && <div className="text-[11px] text-muted-foreground">{teachMsg}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Training matches */}
            {matches.length > 0 && (
              <div className="rounded-xl glass p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-primary" />
                  Matched against your training library
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {matches.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-lg border border-border">
                      <img src={supabase.storage.from("training-charts").getPublicUrl(m.image_path).data.publicUrl}
                        alt="" className="h-32 w-full object-cover" />
                      <div className="p-2">
                        <div className="text-[10px] font-mono uppercase text-primary">{m.label.replace(/_/g, " ")}</div>
                        {m.note && <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{m.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
