// POST /api/nonprofit/onboarding/chat — one conversational-onboarding turn.
// LOCAL model only ($0), no DB write, so no auth gate here — the final save
// (POST /api/nonprofit/profile) is the auth-gated, DB-writing step.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runConversationTurn, type ChatMessage } from "@/lib/nonprofit/conversation";
import { CostMeter, newRunId } from "@/lib/ai/cost";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(60)
    .default([]),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid conversation payload." }, { status: 400 });
    }
    const meter = new CostMeter(newRunId());
    const turn = await runConversationTurn(meter, parsed.data.messages as ChatMessage[]);
    return NextResponse.json({ ...turn, receipt: meter.receipt() });
  } catch (err) {
    console.error("[/api/nonprofit/onboarding/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Intake failed." },
      { status: 500 },
    );
  }
}
