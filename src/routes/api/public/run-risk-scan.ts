import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-friendly endpoint: continuously refresh the market risk radar.
export const Route = createFileRoute("/api/public/run-risk-scan")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runRiskScan } = await import("@/lib/market.functions");
          const result = await (runRiskScan as any)({ data: { source: "cron" } });
          return Response.json({ ok: true, report: result?.report ?? null });
        } catch (e: any) {
          console.error("[run-risk-scan route]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () => {
        const { data } = await supabaseAdmin
          .from("risk_reports").select("*").order("created_at", { ascending: false }).limit(1);
        return Response.json({ latest: data?.[0] ?? null });
      },
    },
  },
});
