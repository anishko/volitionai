// Phase 5 outreach drafting — LOCAL (Ollama qwen3:8b, think:false, $0). The AI
// PREPARES a send in the org's own voice; a human pulls the trigger. Nothing is
// ever sent. Date-grounded, grounded in the match's cited claims (never invents
// facts). Falls back to cloud only if Ollama is unreachable — logged as
// fallback:cloud, never silent. Every call is metered.
import { ollamaChat } from "@/lib/ai/ollama";
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import type {
  Event,
  EventMatch,
  NonprofitProfile,
  OutreachDraftType,
  OutreachModelRoute,
  SourcedClaim,
} from "@/types";

// Human-readable current date so the model grounds timing in the present and
// never frames a past date as upcoming (kept local to avoid importing audited code).
function todayStr(): string {
  const M = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const d = new Date();
  return `${M[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const BASE_SYSTEM = `You draft outreach for a mission-driven nonprofit in ITS OWN VOICE. The AI prepares the message; a human reviews and sends it — you never send anything.
HARD RULES:
- Ground every specific claim (a fact about the event, a donor, a deadline, a sponsor) ONLY in the CITED CLAIMS provided. Never invent a name, date, number, or fact that is not in them.
- Match the org's voice when a voice profile is given; otherwise write warm, credible, and concise.
- Output ONLY the finished message body — no subject line label chatter, no preamble, no quotes, no explanation. A subject line as the first line is fine.
- Keep it tight (roughly 120–200 words). Specific beats generic.`;

const TYPE_INSTRUCTIONS: Record<OutreachDraftType, string> = {
  sponsor_pitch:
    "Write a SPONSORSHIP PITCH email to the event's sponsorship lead. Connect the org's mission to the event's audience and make a specific, modest ask to explore sponsorship. Reference one concrete, cited reason this event fits.",
  cfp_abstract:
    "Write a CALL-FOR-PROPOSALS (speaking) ABSTRACT proposing a session for this event, shaped to the event's themes. State the talk's angle and why this org is credible to give it, grounded in cited facts.",
  intro_email:
    "Write a short INTRODUCTION / MEETING-REQUEST email to a relevant funder or program officer connected to this event (e.g. a donor-signal foundation). Introduce the org, note the shared interest grounded in cited facts, and request a brief conversation.",
};

function voiceLine(profile: NonprofitProfile): string {
  const v = profile.voiceProfile;
  if (v && typeof v === "object" && Object.keys(v).length > 0) {
    return `VOICE PROFILE (write in this voice): ${JSON.stringify(v).slice(0, 800)}`;
  }
  return "VOICE PROFILE: (none provided — write warm, credible, and concise in the org's plain voice)";
}

function buildPrompt(args: {
  profile: NonprofitProfile;
  match: EventMatch;
  event: Event | null;
  draftType: OutreachDraftType;
}): string {
  const { profile, match, event, draftType } = args;
  const claims = match.evidence.map((e, i) => `[${i + 1}] ${e.claim} (source: ${e.sourceUrl})`).join("\n") || "(none)";
  const eventLine = event
    ? `EVENT: ${event.name}${event.website ? ` — ${event.website}` : ""}${event.startDate ? ` — ${event.startDate}` : ""}${[event.locationCity, event.locationState].filter(Boolean).length ? ` — ${[event.locationCity, event.locationState].filter(Boolean).join(", ")}` : ""}`
    : "EVENT: (details in the cited claims below)";

  return `TODAY'S DATE: ${todayStr()}. Reference only present/future timeframes.

${TYPE_INSTRUCTIONS[draftType]}

ORGANIZATION: ${profile.orgName}
CAUSE AREAS: ${profile.causeAreas.join(", ") || "(unspecified)"}
PRIMARY GOAL: ${profile.primaryGoal ?? "grow funding and relationships"}
${voiceLine(profile)}

${eventLine}
WHY THIS EVENT FITS (context): ${match.whyAttend}${match.donorSignalCallout ? `\nDONOR SIGNAL: ${match.donorSignalCallout}` : ""}

CITED CLAIMS (the ONLY facts you may state as specifics):
${claims}

Write the message now.`;
}

export interface DraftResult {
  body: string;
  evidence: SourcedClaim[];      // the match's cited claims the draft drew on
  modelRoute: OutreachModelRoute;
}

export async function draftOutreach(
  meter: CostMeter,
  args: { profile: NonprofitProfile; match: EventMatch; event: Event | null; draftType: OutreachDraftType },
): Promise<DraftResult> {
  const prompt = buildPrompt(args);

  // LOCAL first ($0). qwen3 ships with think ON; ollama.ts forces think:false.
  try {
    const r = await ollamaChat({ system: BASE_SYSTEM, prompt, temperature: 0.6 });
    if (!r.text.trim()) throw new Error("empty local draft");
    meter.ollama({
      stage: "draft",
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      latencyMs: r.latencyMs,
    });
    return { body: r.text.trim(), evidence: args.match.evidence, modelRoute: "local" };
  } catch (err) {
    console.warn("[outreach] local draft failed, falling back to cloud:", err instanceof Error ? err.message : err);
  }

  // Fallback: cloud (never silent — logged as fallback:cloud on the receipt).
  const r = await anthropicMessage({ system: BASE_SYSTEM, prompt, maxTokens: 700 });
  meter.anthropic({
    stage: "draft",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });
  return { body: r.text.trim(), evidence: args.match.evidence, modelRoute: "fallback:cloud" };
}
