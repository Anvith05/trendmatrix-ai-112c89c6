// Agentic deliberation layer. Real LLM agents review the quantitative
// shortlist, each from its own specialty, then a Master agent reads all
// their opinions + user rules + journal lessons and makes the final call.
// Server-only.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export class AgentGatewayError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

// Streams a Responses call and returns the parsed JSON object.
async function callAgentJSON<T>(system: string, user: string, schema: Record<string, unknown>, name: string): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AgentGatewayError(401, "LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      instructions: system,
      input: [{ role: "user", content: user }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new AgentGatewayError(res.status, `AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "error" || ev.type === "response.failed") {
          throw new AgentGatewayError(500, JSON.stringify(ev).slice(0, 300));
        }
      } catch (e) {
        if (e instanceof AgentGatewayError) throw e;
      }
    }
  }
  if (!out.trim()) throw new AgentGatewayError(500, `${name}: empty response`);
  return JSON.parse(out) as T;
}

export type Candidate = {
  symbol: string; name: string; sector: string; ltp: number; change_pct: number;
  scores: Record<string, number>;
  reasons: Record<string, string>;
  tags: string[];
  breakout: { breakout_price: number; pct_above: number; bars_since: number };
  monthly_closes: number[]; // ~12 month-end closes
  weekly_closes: number[];  // ~26 week-end closes
  sector_score: number;
};

export type Opinion = { symbol: string; verdict: "bullish" | "neutral" | "bearish"; score: number; reasoning: string };
export type MasterDecision = {
  symbol: string; approve: boolean; conviction: number; stop_loss: number; thesis: string; key_risk: string;
};

const opinionSchema = {
  type: "object", additionalProperties: false, required: ["summary", "opinions"],
  properties: {
    summary: { type: "string" },
    opinions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["symbol", "verdict", "score", "reasoning"],
        properties: {
          symbol: { type: "string" },
          verdict: { type: "string", enum: ["bullish", "neutral", "bearish"] },
          score: { type: "number" },
          reasoning: { type: "string" },
        },
      },
    },
  },
};

const masterSchema = {
  type: "object", additionalProperties: false, required: ["summary", "decisions"],
  properties: {
    summary: { type: "string" },
    decisions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["symbol", "approve", "conviction", "stop_loss", "thesis", "key_risk"],
        properties: {
          symbol: { type: "string" },
          approve: { type: "boolean" },
          conviction: { type: "number" },
          stop_loss: { type: "number" },
          thesis: { type: "string" },
          key_risk: { type: "string" },
        },
      },
    },
  },
};

const BASE = `You are part of TrendMatrix AI, a multi-agent swing-trading desk for Indian equities/ETFs (NSE/BSE).
Core strategy: strong monthly uptrend + weekly consolidation (base) + sector in sync, entered at the breakout line or a retest, never more than +10% above the breakout line. Target is +10% within ~90 days.
Judge only from the data given. Never invent numbers, news, or fundamentals that are not in the input. Score 0-100. Keep each reasoning to 1-2 sentences citing the concrete numbers you used.`;

type SpecialistDef = { id: string; role: string; pick: (c: Candidate) => Record<string, unknown> };

const SPECIALISTS: SpecialistDef[] = [
  {
    id: "sector", role: "Sector Sync agent: decide if the stock's sector is genuinely leading (sector score vs peers, RS vs Nifty) so the move has sector backing.",
    pick: (c) => ({ sector: c.sector, sector_score: c.sector_score, rs_score: c.scores.rs, rs: c.reasons.rs }),
  },
  {
    id: "monthly", role: "Monthly Trend agent: judge the strength and maturity of the long-term uptrend from month-end closes. Penalise late-stage, parabolic or broken trends.",
    pick: (c) => ({ monthly_closes: c.monthly_closes, monthly_score: c.scores.monthly, detail: c.reasons.monthly }),
  },
  {
    id: "weekly", role: "Weekly Consolidation agent: judge the quality of the base (tightness, length, position) and whether the breakout is clean or a likely false breakout.",
    pick: (c) => ({ weekly_closes: c.weekly_closes, weekly_score: c.scores.weekly, base: c.reasons.weekly, breakout: c.breakout, volume: c.reasons.volume, volume_score: c.scores.volume }),
  },
  {
    id: "history", role: "Historical Pattern agent: compare this setup with the user's labelled training charts and past journal winners/losers. Bullish only if it resembles winners and not losers.",
    pick: (c) => ({ tags: c.tags, pattern_match_score: c.scores.history }),
  },
  {
    id: "fundamental", role: "Quality agent: judge price-quality, liquidity and momentum health (52w-high proximity, RSI, traded value). Flag illiquid or overbought names.",
    pick: (c) => ({ fundamental_score: c.scores.fundamental, detail: c.reasons.fundamental, ltp: c.ltp, change_pct: c.change_pct }),
  },
  {
    id: "macro", role: "Macro agent: given the Nifty regime and recent market headlines, say whether the environment supports new long swing entries in this stock's sector.",
    pick: (c) => ({ sector: c.sector }),
  },
];

export async function deliberate(input: {
  candidates: Candidate[];
  rules: Record<string, string[]>;
  trainingSummary: string;
  journalLessons: string;
  macroContext: string;
  maxPicks: number;
}) {
  const { candidates } = input;
  const specialistResults = await Promise.allSettled(
    SPECIALISTS.map(async (s) => {
      const rules = input.rules[s.id] ?? [];
      const extra =
        s.id === "history" ? `\nTRAINING LIBRARY:\n${input.trainingSummary}\nJOURNAL LESSONS:\n${input.journalLessons}`
        : s.id === "macro" ? `\nMACRO CONTEXT:\n${input.macroContext}`
        : "";
      const user = `${extra}\nUSER RULES FOR YOU (must obey):\n${rules.length ? rules.map((r) => "- " + r).join("\n") : "(none)"}\n\nCANDIDATES:\n${JSON.stringify(candidates.map((c) => ({ symbol: c.symbol, name: c.name, ...s.pick(c) })))}\n\nReturn one opinion per candidate symbol.`;
      const r = await callAgentJSON<{ summary: string; opinions: Opinion[] }>(`${BASE}\n\n${s.role}`, user, opinionSchema, `${s.id}_opinions`);
      return { agent: s.id, ...r };
    }),
  );

  const specialists: Record<string, { summary: string; opinions: Opinion[]; error?: string }> = {};
  specialistResults.forEach((r, i) => {
    const id = SPECIALISTS[i].id;
    if (r.status === "fulfilled") specialists[id] = { summary: r.value.summary, opinions: r.value.opinions };
    else specialists[id] = { summary: "", opinions: [], error: String((r.reason as Error)?.message ?? r.reason) };
  });

  // Hard-stop on billing/permission errors so the caller can pause.
  const fatal = specialistResults.find(
    (r) => r.status === "rejected" && r.reason instanceof AgentGatewayError && [401, 402, 403].includes(r.reason.status),
  );
  if (fatal && fatal.status === "rejected") throw fatal.reason;
  const ok = Object.values(specialists).filter((s) => !s.error).length;
  if (ok < 3) throw new AgentGatewayError(503, "Too few specialist agents responded");

  const board = candidates.map((c) => ({
    symbol: c.symbol, name: c.name, sector: c.sector, ltp: c.ltp,
    breakout_line: c.breakout.breakout_price, pct_above_breakout: Number(c.breakout.pct_above.toFixed(2)),
    quant_scores: c.scores,
    agents: Object.fromEntries(
      Object.entries(specialists).map(([id, s]) => [id, s.opinions.find((o) => o.symbol === c.symbol) ?? null]),
    ),
  }));

  const masterUser = `USER RULES FOR MASTER (must obey):\n${(input.rules.master ?? []).map((r) => "- " + r).join("\n") || "(none)"}
JOURNAL LESSONS (learn from losers, repeat what made winners):\n${input.journalLessons}
SPECIALIST SUMMARIES:\n${Object.entries(specialists).map(([id, s]) => `${id}: ${s.error ? "unavailable" : s.summary}`).join("\n")}
DEBATE BOARD:\n${JSON.stringify(board)}

Reconcile disagreements between agents. Approve AT MOST ${input.maxPicks} candidates, and only genuinely high-quality setups — it is fine to approve zero. For every candidate return a decision. stop_loss must be a price below the breakout line (typically just under the base). conviction 0-100.`;

  const master = await callAgentJSON<{ summary: string; decisions: MasterDecision[] }>(
    `${BASE}\n\nYou are the Master Conviction agent (lead portfolio manager). You read every specialist's opinion and make the final, accountable decision.`,
    masterUser, masterSchema, "master_decisions",
  );
  const decisions = (master.decisions ?? [])
    .filter((d) => candidates.some((c) => c.symbol === d.symbol))
    .map((d) => ({ ...d, conviction: Math.max(0, Math.min(100, Math.round(d.conviction))) }));
  const approved = decisions
    .filter((d) => d.approve && d.conviction >= 65)
    .sort((a, b) => b.conviction - a.conviction)
    .slice(0, input.maxPicks);

  return { specialists, master: { summary: master.summary, decisions }, approved, model: MODEL };
}
