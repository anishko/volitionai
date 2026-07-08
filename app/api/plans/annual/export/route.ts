// GET /api/plans/annual/export — the "Annual Conference Plan": a clean,
// printable board budget-justification artifact. Every number is either sourced
// (with its link) or explicitly labeled "estimate"; events whose registration
// cost can't be sourced are listed as "cost unverified" and excluded from the
// total, never guessed. Rendered as standalone HTML so it prints/saves to PDF
// straight from the browser (no client JS, no external assets).
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAnnualPlan, type AnnualCandidate } from "@/lib/plans/annual";

export const runtime = "nodejs";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(iso?: string): string {
  if (!iso) return "Dates TBA";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(`${m[0]}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function locationOf(event: AnnualCandidate["event"]): string {
  const parts = [event.locationCity, event.locationState, event.locationCountry].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return event.format ? event.format.replace("_", " ") : "Location TBA";
}

interface EventExtras {
  whyAttend?: string;
  certificates: { type: string; sourceUrl: string }[];
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const annual = await buildAnnualPlan(supabase);
    if (!annual) {
      return NextResponse.json({ error: "No profile yet." }, { status: 404 });
    }

    const slate = annual.candidates.filter((c) => c.inSlate);
    const eventIds = slate.map((c) => c.event.id);

    // why_attend (from the match) + certificates_offered (v3 event column) are
    // not on the app-facing contracts we consume, so read them directly here.
    const extras = new Map<string, EventExtras>();
    if (eventIds.length > 0) {
      const [{ data: matchRows }, { data: certRows }] = await Promise.all([
        supabase.from("event_matches").select("event_id, why_attend").in("event_id", eventIds),
        supabase.from("events").select("id, certificates_offered").in("id", eventIds),
      ]);
      for (const id of eventIds) extras.set(id, { certificates: [] });
      for (const r of matchRows ?? []) {
        const row = r as { event_id: string; why_attend: string | null };
        const e = extras.get(row.event_id);
        if (e && row.why_attend) e.whyAttend = row.why_attend;
      }
      for (const r of certRows ?? []) {
        const row = r as { id: string; certificates_offered: unknown };
        const e = extras.get(row.id);
        if (!e) continue;
        const certs = Array.isArray(row.certificates_offered) ? row.certificates_offered : [];
        e.certificates = certs.flatMap((c) => {
          const obj = c as Record<string, unknown>;
          const type = typeof obj.type === "string" ? obj.type : "";
          const sourceUrl = typeof obj.source_url === "string" ? obj.source_url : "";
          return type && sourceUrl ? [{ type, sourceUrl }] : [];
        });
      }
    }

    const grandTotal = annual.citedTotal + annual.travelEstimateTotal;
    const cap = annual.annualBudgetCap;
    const overCap = cap != null && grandTotal > cap;

    const rows = slate
      .map((c) => {
        const ex = extras.get(c.event.id) ?? { certificates: [] };
        const cost = c.registrationCost;
        const costCell = cost
          ? `${usd(cost.amount)} <a href="${esc(cost.sourceUrl)}">source</a><br><span class="muted">verified ${esc(
              fmtDate(cost.verifiedAt),
            )}</span>`
          : `<span class="unverified">cost unverified — excluded from total</span>`;
        const travel =
          c.estimatedTravelCost != null && c.estimatedTravelCost > 0
            ? `${usd(c.estimatedTravelCost)} <span class="estimate">estimate</span>`
            : `<span class="muted">—</span>`;
        const certs =
          ex.certificates.length > 0
            ? `<div class="certs">Certificates / CE: ${ex.certificates
                .map((cert) => `<a href="${esc(cert.sourceUrl)}">${esc(cert.type)}</a>`)
                .join(", ")}</div>`
            : "";
        const why = ex.whyAttend ? `<div class="why">${esc(ex.whyAttend)}</div>` : "";
        return `<tr>
          <td>
            <div class="ename"><a href="${esc(c.event.website)}">${esc(c.event.name)}</a></div>
            <div class="muted">${esc(fmtDate(c.event.startDate))} · ${esc(locationOf(c.event))}${
              c.participationTier ? ` · ${esc(c.participationTier)}` : ""
            }</div>
            ${why}${certs}
          </td>
          <td class="num">${costCell}</td>
          <td class="num">${travel}</td>
        </tr>`;
      })
      .join("\n");

    const capLine =
      cap != null
        ? `<div class="cap ${overCap ? "over" : "under"}">
             Total ${usd(grandTotal)} of ${usd(cap)} cap${
               overCap ? ` · <strong>over cap by ${usd(grandTotal - cap)}</strong>` : ` · ${usd(cap - grandTotal)} remaining`
             }
           </div>`
        : `<div class="cap">Total ${usd(grandTotal)} · no annual cap set</div>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Annual Conference Plan${annual.period ? ` — ${esc(annual.period)}` : ""}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #18181b; margin: 0; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 40px 32px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #52525b; margin: 0 0 20px; }
  .cap { font-size: 16px; font-weight: 600; padding: 12px 16px; border-radius: 8px; background: #f4f4f5; margin-bottom: 8px; }
  .cap.over { background: #fef2f2; color: #991b1b; }
  .cap.under { background: #f0fdf4; color: #166534; }
  .totals { color: #52525b; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #71717a; border-bottom: 2px solid #e4e4e7; padding: 8px 10px; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  td { border-bottom: 1px solid #f0f0f2; padding: 12px 10px; vertical-align: top; }
  .ename { font-weight: 600; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: #a1a1aa; font-size: 12px; }
  .why { color: #3f3f46; font-size: 13px; margin-top: 6px; max-width: 46ch; }
  .certs { font-size: 12px; margin-top: 6px; color: #52525b; }
  .estimate { display: inline-block; font-size: 11px; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 4px; padding: 1px 6px; }
  .unverified { color: #b45309; font-size: 12px; }
  .footer { margin-top: 24px; color: #a1a1aa; font-size: 12px; }
  .toolbar { margin-bottom: 20px; }
  button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer; }
  @media print { .toolbar { display: none; } .page { padding: 0; } a { color: #18181b; } }
</style>
</head>
<body>
  <div class="page">
    <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
    <h1>Annual Conference Plan</h1>
    <p class="sub">${esc(annual.orgName)}${annual.period ? ` · Budget period ${esc(annual.period)}` : ""}</p>
    ${capLine}
    <p class="totals">Registration (cited): ${usd(annual.citedTotal)} · Travel (estimated): ${usd(
      annual.travelEstimateTotal,
    )} · ${annual.slateCount} event${annual.slateCount === 1 ? "" : "s"}${
      annual.unverifiedInSlate > 0
        ? ` · ${annual.unverifiedInSlate} with unverified cost (excluded from total)`
        : ""
    }</p>
    <table>
      <thead>
        <tr><th>Event</th><th class="num">Registration</th><th class="num">Travel</th></tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="3" class="muted">No events in the slate yet.</td></tr>`}
      </tbody>
    </table>
    <p class="footer">Every registration cost links to its source and shows a verified date. Travel figures are estimates, labeled as such, and never cited. Costs that could not be sourced are marked "cost unverified" and excluded from the total.</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/plans/annual/export GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build export." },
      { status: 500 },
    );
  }
}
