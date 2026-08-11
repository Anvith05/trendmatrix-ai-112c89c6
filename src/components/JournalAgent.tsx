import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { getJournalChat, sendJournalChat } from "@/lib/market.functions";
import { Bot, Loader2, Send, User, X } from "lucide-react";

type Msg = { role: string; message: string; created_at?: string };

const SUGGESTIONS = [
  "What is my win rate by sector?",
  "Which setups failed and why?",
  "Should I change the +10% target or the 3-month window?",
  "Summarise my current running trades and the risk in them",
];

export function JournalAgent() {
  const load = useServerFn(getJournalChat);
  const send = useServerFn(sendJournalChat);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try { setMsgs(((await load()) as any) ?? []); } catch { /* ignore */ }
    })();
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function submit(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setMsgs((m) => [...m, { role: "user", message: q }]);
    setBusy(true);
    try {
      const r: any = await send({ data: { message: q } });
      setMsgs((m) => [...m, { role: "assistant", message: r.reply }]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Journal Analyst Agent"
        aria-label="Open Journal Analyst Agent"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gradient-primary)] glow transition hover:scale-105"
      >
        <Bot className="h-5 w-5 !text-white" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-background/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
    <section className="w-full max-w-2xl rounded-xl glass p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Journal Analyst Agent</h2>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          full data access
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Reads your journal, live picks, agent rankings, sector scores and training library — ask anything about
        performance, failures or parameter tuning.
      </p>


      <div ref={boxRef} className="max-h-[26rem] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-3">
        {msgs.length === 0 && !busy && (
          <div className="py-6 text-center text-sm text-muted-foreground">Ask the analyst a question to begin.</div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role !== "user" && <Bot className="mt-1 h-4 w-4 shrink-0 text-primary" />}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "bg-primary/15 text-foreground" : "bg-secondary/40"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-table:text-xs prose-headings:mt-2">
                <ReactMarkdown>{m.message}</ReactMarkdown>
              </div>
            </div>
            {m.role === "user" && <User className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing your data…
          </div>
        )}
      </div>

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => submit(s)} disabled={busy}
            className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
          placeholder="e.g. Which sector gave me the fastest 10% targets?"
          className="flex-1 resize-none rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="flex items-center gap-2 rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold !text-white glow disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>
    </section>
  );
}
