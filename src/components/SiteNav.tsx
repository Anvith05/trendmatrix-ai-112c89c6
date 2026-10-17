import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 glass border-b border-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold tracking-tight">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gradient-primary)] glow">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-base">TrendMatrix<span className="text-gradient"> AI</span></span>
          <span className="ml-2 hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">NSE · BSE</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {[
            { to: "/dashboard", label: "Dashboard" },
            { to: "/picks", label: "Top Picks" },
            { to: "/journal", label: "Journal" },
            { to: "/research", label: "Research" },
            { to: "/agents", label: "AI Agents" },
            { to: "/sectors", label: "Sectors" },
            { to: "/macro", label: "Macro Radar" },
            { to: "/health", label: "Health" },
            
            { to: "/training", label: "Training Lab" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          LIVE
        </div>
      </div>
    </header>
  );
}
