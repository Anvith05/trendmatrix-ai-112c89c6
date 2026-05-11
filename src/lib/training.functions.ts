import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VISION_PROMPT = `You are a swing-trading chart analyst. The user uploaded a chart screenshot they consider an instructive example.
Extract structured pattern features. Respond by calling extract_pattern.`;

export const extractTrainingFeatures = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { data: row } = await supabaseAdmin.from("training_examples").select("*").eq("id", data.id).single();
    if (!row) throw new Error("not found");
    const { data: pub } = supabaseAdmin.storage.from("training-charts").getPublicUrl(row.image_path);
    const imageUrl = pub.publicUrl;

    const userText = [
      `Pattern label: ${row.label}`,
      row.symbol ? `Symbol: ${row.symbol}` : null,
      row.sector ? `Sector: ${row.sector}` : null,
      row.note ? `User note: ${row.note}` : null,
    ].filter(Boolean).join("\n");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: VISION_PROMPT },
        { role: "user", content: [
          { type: "text", text: userText || "Analyze this chart." },
          { type: "image_url", image_url: { url: imageUrl } },
        ] },
      ],
      tools: [{
        type: "function", function: {
          name: "extract_pattern",
          description: "Structured features from the chart",
          parameters: {
            type: "object",
            properties: {
              tags: { type: "array", items: { type: "string" }, description: "lowercase snake_case tags e.g. tight_base, volume_surge, breakout, accumulation, weekly_consolidation, strong_uptrend" },
              monthly_trend: { type: "string", enum: ["up", "down", "sideways"] },
              weekly_structure: { type: "string", enum: ["tight_base", "loose_base", "expansion", "downtrend"] },
              volume_behavior: { type: "string", enum: ["dry_up", "accumulation", "climax", "neutral"] },
              quality: { type: "integer", minimum: 0, maximum: 100, description: "Setup quality 0-100" },
              summary: { type: "string", description: "1-sentence description" },
            },
            required: ["tags", "monthly_trend", "weekly_structure", "volume_behavior", "quality", "summary"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_pattern" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("No tool call from model");

    await supabaseAdmin.from("training_examples").update({
      tags: args.tags, features: args,
    }).eq("id", data.id);

    return args;
  });
