import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";
import { extractTrainingFeatures } from "@/lib/training.functions";
import { Brain, Upload, Trash2, ImageIcon, Tag, Sparkles, TrendingUp, Activity, Gauge } from "lucide-react";

export const Route = createFileRoute("/training")({ component: TrainingLab,
  head: () => ({ meta: [{ title: "AI Training Lab · TrendMatrix AI" }] }),
});

const LABELS = [
  { id: "successful_breakout", label: "Successful breakout" },
  { id: "failed_breakout", label: "Failed breakout" },
  { id: "accumulation", label: "Accumulation" },
  { id: "sector_rally", label: "Sector rally setup" },
  { id: "momentum_expansion", label: "Momentum expansion" },
  { id: "weekly_consolidation", label: "Weekly consolidation" },
];

type Features = {
  tags?: string[];
  monthly_trend?: string;
  weekly_structure?: string;
  volume_behavior?: string;
  quality?: number;
  summary?: string;
};
type Row = {
  id: string;
  image_path: string;
  label: string;
  note: string | null;
  symbol: string | null;
  sector: string | null;
  created_at: string;
  tags: string[] | null;
  features: Features | null;
};

function TrainingLab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState(LABELS[0].id);
  const [note, setNote] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sector, setSector] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data, error } = await supabase
      .from("training_examples")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as Row[]);
  }

  useEffect(() => { load(); }, []);

  function publicUrl(path: string) {
    return supabase.storage.from("training-charts").getPublicUrl(path).data.publicUrl;
  }

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const extract = useServerFn(extractTrainingFeatures);

  const [lastExtract, setLastExtract] = useState<Features | null>(null);

  async function save() {
    if (!file) { setMsg("Pick an image first."); return; }
    setBusy(true); setMsg(null); setLastExtract(null);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("training-charts").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const ins = await supabase.from("training_examples").insert({
        image_path: path,
        label,
        note: note || null,
        symbol: symbol || null,
        sector: sector || null,
      }).select().single();
      if (ins.error) throw ins.error;
      setMsg("Saved · AI is reading the chart…");
      try {
        const features = await extract({ data: { id: ins.data.id } });
        setLastExtract(features as Features);
        setMsg("AI extraction complete · tags added to the pattern-matching library.");
      } catch (e: any) {
        setMsg(`Saved (vision extract failed: ${e?.message ?? e})`);
      }
      setFile(null); setPreview(null); setNote(""); setSymbol(""); setSector("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Row) {
    if (!confirm("Delete this example?")) return;
    await supabase.storage.from("training-charts").remove([r.image_path]);
    await supabase.from("training_examples").delete().eq("id", r.id);
    await load();
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gradient-primary)] glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary">Personal Training Lab</div>
            <h1 className="font-display text-3xl font-bold">Teach the AI your setups</h1>
          </div>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Upload chart screenshots one at a time. Add a label and a note explaining what to look for — the AI will
          extract structure (monthly trend, weekly base, support/resistance, volume behavior) and compare every NSE/BSE
          stock against your library.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload card */}
          <div className="rounded-xl glass p-5">
            <div className="text-sm font-semibold">Upload one chart</div>
            <label className="mt-4 flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/40 transition hover:border-primary/60">
              {preview ? (
                <img src={preview} alt="preview" className="h-full w-full rounded-lg object-contain" />
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <div className="mt-2 text-sm">Click to choose a chart screenshot</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">PNG · JPG · WEBP</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground">Pattern label</label>
                <select value={label} onChange={(e) => setLabel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                  {LABELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground">Symbol (optional)</label>
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="HAL"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm" />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-mono uppercase text-muted-foreground">Sector (optional)</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Defence"
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-mono uppercase text-muted-foreground">Note for the AI</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
                placeholder="e.g. 11-week tight base after a strong monthly uptrend, volume drying up, breakout above 1840 with sector confirmation."
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            </div>

            <button onClick={save} disabled={busy || !file}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground glow disabled:opacity-50">
              <Upload className="h-4 w-4" /> {busy ? "Saving…" : "Save example"}
            </button>
            {msg && <div className="mt-3 text-xs text-muted-foreground">{msg}</div>}
            {lastExtract && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-primary">
                  <Sparkles className="h-3 w-3" /> AI extracted from this chart
                </div>
                {lastExtract.summary && (
                  <p className="mt-2 text-xs text-foreground">{lastExtract.summary}</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3 text-primary" /><span className="text-muted-foreground">Monthly:</span> <b>{lastExtract.monthly_trend}</b></div>
                  <div className="flex items-center gap-1.5"><Activity className="h-3 w-3 text-primary" /><span className="text-muted-foreground">Weekly:</span> <b>{lastExtract.weekly_structure?.replace(/_/g, " ")}</b></div>
                  <div className="flex items-center gap-1.5"><Activity className="h-3 w-3 text-primary" /><span className="text-muted-foreground">Volume:</span> <b>{lastExtract.volume_behavior?.replace(/_/g, " ")}</b></div>
                  <div className="flex items-center gap-1.5"><Gauge className="h-3 w-3 text-primary" /><span className="text-muted-foreground">Quality:</span> <b>{lastExtract.quality}/100</b></div>
                </div>
                {lastExtract.tags && lastExtract.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lastExtract.tags.map((t) => (
                      <span key={t} className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-muted-foreground">
                  ✓ Sent to the pattern-matching agent — every NSE/BSE scan now compares against this example.
                </div>
              </div>
            )}
          </div>

          {/* Library */}
          <div className="rounded-xl glass p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Your training library</div>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rows.length} examples
              </span>
            </div>
            <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {rows.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-6 w-6" />
                  No examples yet — upload your first chart on the left.
                </div>
              )}
              {rows.map((r) => (
                <div key={r.id} className="flex gap-3 rounded-lg border border-border p-3">
                  <img src={publicUrl(r.image_path)} alt="" className="h-24 w-32 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase text-primary">
                        <Tag className="mr-1 inline h-2.5 w-2.5" />{r.label.replace(/_/g, " ")}
                      </span>
                      {r.symbol && <span className="font-mono text-xs font-semibold">{r.symbol}</span>}
                      {r.sector && <span className="text-[11px] text-muted-foreground">· {r.sector}</span>}
                    </div>
                    {r.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.note}</p>}
                    {r.features?.summary && (
                      <p className="mt-1 line-clamp-2 text-[11px] italic text-foreground/80">
                        <Sparkles className="mr-1 inline h-2.5 w-2.5 text-primary" />{r.features.summary}
                      </p>
                    )}
                    {r.tags && r.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.tags.slice(0, 6).map((t) => (
                          <span key={t} className="rounded border border-border bg-card px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                      {r.features ? <span className="ml-2 text-primary">· indexed</span> : <span className="ml-2 text-amber-500">· pending</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(r)} className="self-start rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
