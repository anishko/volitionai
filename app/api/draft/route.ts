// POST /api/draft — LOCAL "draft it" in the org's voice ($0). Body: { profile, card }
import { NextRequest, NextResponse } from "next/server";
import { draftInVoice } from "@/lib/pipeline/draft";
import { ProfileSchema, IdeaCardCoreSchema } from "@/lib/pipeline/schema";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

// Accept a full IdeaCard (core fields + id) for drafting.
const CardInput = IdeaCardCoreSchema.extend({
  id: z.string().optional(),
  draftContent: z.string().optional(),
  isSample: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = ProfileSchema.parse(body?.profile);
    const card = CardInput.parse(body?.card);
    const draft = await draftInVoice(profile, {
      id: card.id ?? "draft",
      ...card,
    });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[/api/draft]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft failed." },
      { status: 500 },
    );
  }
}
