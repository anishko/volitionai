// Feed card for a matched event, in the Evidence Dossier system. Shows the
// score, why-attend, the donor-signal callout, and the citation chips backing
// the match — then links into the full detail page (issue #6). Presentational
// and server-rendered; Save/Dismiss actions belong to the feed's issue.
import Link from "next/link";
import type { Event, EventMatch } from "@/types";

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function metaLine(event: Event): string {
  const start = formatDate(event.startDate);
  const end = formatDate(event.endDate);
  const dates =
    start && end ? (start === end ? start : `${start} – ${end}`) : start ?? end;
  const place = [event.locationCity, event.locationState].filter(Boolean).join(", ");
  const format =
    event.format === "in_person"
      ? "In person"
      : event.format === "virtual"
        ? "Virtual"
        : event.format === "hybrid"
          ? "Hybrid"
          : undefined;
  return [dates, place, format].filter(Boolean).join(" · ") || "Details to be announced";
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function EventCard({ match, event }: { match: EventMatch; event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-all hover:border-brand/40 hover:shadow-[0_18px_40px_-24px_rgba(15,22,38,0.35)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl text-foreground group-hover:text-brand">
            {event.name}
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {metaLine(event)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-brand/25 bg-accent px-3 py-1.5 text-center">
          <div className="tabular font-display text-xl font-semibold leading-none text-brand">
            {match.matchScore}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            match
          </div>
        </div>
      </div>

      {match.whyAttend && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-card-foreground">
          {match.whyAttend}
        </p>
      )}

      {match.donorSignalCallout && (
        <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-signal">
            Donor signal
          </p>
          <p className="mt-0.5 text-sm text-foreground">{match.donorSignalCallout}</p>
        </div>
      )}

      {match.evidence.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {match.evidence.slice(0, 3).map((e, i) => (
            <span key={i} className="citation">
              ↗ {hostname(e.sourceUrl)}
            </span>
          ))}
          {match.evidence.length > 3 && (
            <span className="citation">+{match.evidence.length - 3} more</span>
          )}
        </div>
      )}
    </Link>
  );
}
