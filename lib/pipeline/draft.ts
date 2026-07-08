// STAGE: "draft it". Runs on Anthropic cloud (Haiku 4.5 default).
import { anthropicMessage } from "@/lib/ai/anthropic";
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

  const r = await anthropicMessage({ system: SYSTEM, prompt, maxTokens: 700 });
  return r.text;
}
