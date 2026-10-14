import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getMacroRegime, type MacroReport } from "@/lib/macro.functions";
import { Globe2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

const LABEL = { risk_on: "Risk-On · Bullish Expansion", caution: "Caution · Distribution", crash_watch: "Crash Watch · Defensive" } as const;
const TONE = { risk_on: "text-success border-success/40", caution: "text-warning border-warning/40", crash_watch: "text-destructive border-destructive/40" } as const;

export function MacroRegimeCard({ full = false }: { full?: boolean }) {
  const fetchFn = useServerFn(getMacroRegime);
  const [r, setR] = useState<MacroReport | null>(null);
  const [busy, setBusy] = useState(false);
  async function load(force = false) {
    setBusy(true);
    try { setR(await fetchFn({ data: { force } })); } catch (e) { console.error(e); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  if (!r) return (
    <div className="glass rounded-xl p-4 mb-6 text-xs font-mono text-muted-foreground flex items-center gap-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Macro Sentinel reading global & Indian markets…
    </div>
  );
  return (
    <div className={`glass rounded-xl border p-4 mb-6 ${TONE[r.regime]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Market Regime & Crash Radar · Indian equities</div>
            <div className="font-display text-lg font-bold">{LABEL[r.regime]} <span className="font-mono text-sm">· risk {r.risk_score}/100</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!full && <Link to="/agents" className="text-xs font-mono underline text-foreground">Full dossier →</Link>}
          <button onClick={() => load(true)} disabled={busy} className="rounded-md glass p-1.5 text-foreground disabled:opacity-50" aria-label="Refresh macro">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {r.ai && <p className="mt-3 text-sm text-foreground"><b>{r.ai.headline}.</b> {r.ai.briefing}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        {r.indicators.slice(0, full ? 11 : 6).map((i) => (
          <div key={i.key} className="rounded-md bg-background/40 p-2">
            <div className="text-[10px] font-mono text-muted-foreground">{i.label}</div>
            <div className="text-sm font-semibold text-foreground">{i.value?.toFixed(2) ?? "—"}</div>
            {i.chg1m != null && <div className={`text-[10px] font-mono ${i.chg1m >= 0 ? "text-success" : "text-destructive"}`}>{i.chg1m >= 0 ? "+" : ""}{i.chg1m.toFixed(1)}% 1M</div>}
          </div>
        ))}
      </div>
      {r.flags.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-foreground">{r.flags.map((f) => <li key={f}>⚠ {f}</li>)}</ul>}
      {full && r.ai && (
        <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-foreground">
          {([["Playbook now", r.ai.playbook], ["Crash / correction opportunities", r.ai.crash_opportunities], ["Defensive rotation", r.ai.defensive_rotation]] as const).map(([t, list]) => (
            <div key={t} className="rounded-md bg-background/40 p-3">
              <div className="mb-1 font-mono uppercase text-[10px] text-primary">{t}</div>
              <ul className="list-disc pl-4 space-y-1">{list.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
          <div className="md:col-span-3 rounded-md bg-background/40 p-3"><span className="font-mono uppercase text-[10px] text-primary">3–6 month outlook · </span>{r.ai.outlook_3_6m}</div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-muted-foreground"><Globe2 className="h-3 w-3" /> updated {new Date(r.updated_at).toLocaleString()} · probabilities, not certainties</div>
    </div>
  );
}
