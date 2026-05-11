import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-friendly endpoint. Triggers a full pipeline run.
// Public path (no auth) — pg_cron will hit this every 15 min and the dashboard
// can call it on demand. Inline import of runAgents to avoid loader-time SSR.
export const Route = createFileRoute("/api/public/run-agents")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runAgents } = await import("@/lib/market.functions");
          const result = await (runAgents as any)({ data: { source: "cron" } });
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[run-agents route]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () => {
        const { data } = await supabaseAdmin.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(5);
        return Response.json({ runs: data ?? [] });
      },
    },
  },
});
