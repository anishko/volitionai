// POST /api/nonprofit/classify — unified-upload classification (PRD v4).
// Client reads file text and sends { files: [{name, text}] }; the LOCAL model
// classifies + extracts. Raw text is used then dropped (only facts returned).
// Local only, no DB write → no auth gate.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyUpload } from "@/lib/nonprofit/classify";
import { CostMeter, newRunId } from "@/lib/ai/cost";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  files: z
    .array(z.object({ name: z.string().max(300), text: z.string().max(200_000) }))
    .max(10),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
    }
    const meter = new CostMeter(newRunId());
    const results = [];
    for (const f of parsed.data.files) {
      results.push(await classifyUpload(meter, f.name, f.text));
    }
    return NextResponse.json({ results, receipt: meter.receipt() });
  } catch (err) {
    console.error("[/api/nonprofit/classify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed." },
      { status: 500 },
    );
  }
}
