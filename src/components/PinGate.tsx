import { useEffect, useState, type ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";

const KEY = "tm_access_pin_ok";
const PIN = "9912510781";

export function usePinUnlocked() {
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setOk(localStorage.getItem(KEY) === "1");
    setReady(true);
  }, []);
  return { ok, ready, setOk };
}

export function PinGate({ area, children }: { area: string; children: ReactNode }) {
  const { ok, ready, setOk } = usePinUnlocked();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  if (ok) {
    return (
      <>
        <div className="mx-auto flex max-w-7xl items-center justify-end px-4 pt-3">
          <button
            onClick={() => {
              localStorage.removeItem(KEY);
              setOk(false);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
          >
            <ShieldCheck className="h-3 w-3 text-success" /> Unlocked · lock again
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="rounded-2xl glass p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gradient-primary)] glow">
          <Lock className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">{area} is restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Anyone can browse TrendMatrix AI, but editing and chatting with the agents here needs the access PIN.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() === PIN) {
              localStorage.setItem(KEY, "1");
              setOk(true);
              setError(null);
            } else {
              setError("Incorrect PIN");
            }
          }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter access PIN"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-center font-mono tracking-[0.3em] outline-none focus:border-primary"
          />
          {error && <div className="text-xs text-destructive">{error}</div>}
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground glow"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
