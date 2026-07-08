// GET /api/health — booleans only, no secret values. A deploy/demo readiness
// probe: is Supabase configured, is the local Ollama reachable, and are the
// three cloud/data provider keys present? Never returns key contents.
import { NextResponse } from "next/server";
import { OLLAMA_BASE_URL } from "@/lib/ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ollamaReachable(timeoutMs = 2_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const supabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return NextResponse.json({
    supabase,
    ollama: await ollamaReachable(),
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    tavilyKey: Boolean(process.env.TAVILY_API_KEY),
    firecrawlKey: Boolean(process.env.FIRECRAWL_API_KEY),
  });
}
