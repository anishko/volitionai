// POST /api/profile — LOCAL profile extraction ($0). Body: { description, pastContent? }
import { NextRequest, NextResponse } from "next/server";
import { runProfile } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const pastContent =
      typeof body?.pastContent === "string" && body.pastContent.trim()
        ? body.pastContent.trim()
        : undefined;

    if (description.length < 10) {
      return NextResponse.json(
        { error: "Tell me a bit more about your org (at least a sentence)." },
        { status: 400 },
      );
    }

    const result = await runProfile(description, pastContent);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/profile]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile extraction failed." },
      { status: 500 },
    );
  }
}
