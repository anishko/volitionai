// STAGE: "draft it". Runs LOCAL (Ollama, $0) — voice mimicry is a local-model
// strength and this keeps the drafting beat instant and free.
import { ollamaChat } from "@/lib/ai/ollama";
import type { BusinessProfile, IdeaCard } from "@/types";

const SYSTEM = `You are a copywriter drafting short outreach/marketing content in an organization's own voice.
Write ready-to-send content (a DM, email, or post) that executes the given idea. Keep it concise and specific.
Match the org's voice if provided. Output ONLY the drafted content — no preamble, no quotes, no explanation.`;

export async function draftInVoice(
  profile: BusinessProfile,
  card: IdeaCard,
): Promise<string> {
  const prompt = `ORG: ${profile.businessName} (${profile.orgType})
AUDIENCE: ${profile.audience}
VOICE: ${profile.voice ?? "friendly, clear, on-brand"}

IDEA TO EXECUTE: ${card.idea}
CONTEXT (why it fits): ${card.whyItFitsYou}

Draft the content now.`;

  const r = await ollamaChat({ system: SYSTEM, prompt, temperature: 0.6 });
  return r.text;
}
