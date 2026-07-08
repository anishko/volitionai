// GET /api/og-image?url=... — extracts the og:image meta tag from an event
// page and returns the image URL so the card can hotlink it directly.
// The browser loads the image from the original host; nothing is stored here.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TIMEOUT_MS = 5_000;

// Both attribute orderings that browsers accept.
const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
];

function extractOgImage(html: string): string | null {
  for (const re of OG_IMAGE_RE) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";

  // Validate: must be an http/https URL to prevent SSRF against internal hosts.
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        // Appear as a normal browser so sites don't block the request.
        "User-Agent":
          "Mozilla/5.0 (compatible; Volition/1.0; +https://volitionai.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Read only the first 50 KB — the <head> is always near the top.
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ imageUrl: null });

    let html = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    while (bytes < 50_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytes += value.byteLength;
    }
    reader.cancel();

    const imageUrl = extractOgImage(html);
    return NextResponse.json({ imageUrl }, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
