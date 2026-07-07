// /api/ideas — the research run.
//   POST { profile, persona? }  → live run (plan → search → rank → synth → validate → meter)
//   GET  ?cached=1&persona=slug → load a captured fixture (demo insurance)
// Demo insurance envs:
//   DEMO_FALLBACK=1  → POST returns the captured fixture instead of running live
//   CAPTURE_FIXTURE=1 → a successful live POST is persisted under fixtures/demo/<persona>.json
import { NextRequest, NextResponse } from "next/server";
import { runIdeas } from "@/lib/pipeline/run";
import { captureFixture, loadFixture, slugify } from "@/lib/fixtures";
import { ProfileSchema } from "@/lib/pipeline/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_PERSONA = "crestview-trading-club";

export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get("persona") || DEFAULT_PERSONA;
  const fixture = await loadFixture(slugify(persona));
  if (!fixture) {
    return NextResponse.json(
      { error: `No cached run found for "${persona}".` },
      { status: 404 },
    );
  }
  return NextResponse.json({ ...fixture, cached: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const personaSlug = body?.persona ? slugify(String(body.persona)) : undefined;

    // DEMO_FALLBACK: serve the captured run instead of touching the network.
    if (process.env.DEMO_FALLBACK === "1") {
      const fixture = await loadFixture(personaSlug || DEFAULT_PERSONA);
      if (fixture) return NextResponse.json({ ...fixture, cached: true });
      // fall through to live if no fixture exists yet
    }

    const parsed = ProfileSchema.safeParse(body?.profile);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid profile. Extract a profile first." },
        { status: 400 },
      );
    }

    const result = await runIdeas(parsed.data);

    // Write-on-success fixture capture (opt-in via env).
    if (personaSlug && process.env.CAPTURE_FIXTURE === "1") {
      const file = await captureFixture(personaSlug, result);
      if (file) console.log(`[fixture] captured ${file}`);
    }

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[/api/ideas]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Idea generation failed." },
      { status: 500 },
    );
  }
}
