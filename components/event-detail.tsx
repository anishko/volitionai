// Event detail view (issue #6), styled in the Evidence Dossier system. Renders
// the five sections a nonprofit needs to decide on an event — logistics,
// participation options, organizer contacts, known participants, donor signals
// — from the shared events corpus. Every sourced field wears a citation chip;
// empty sections degrade to a quiet placeholder rather than a broken layout,
// and donor signals only appear when the corpus actually carries them.
import Link from "next/link";
import type {
  DonorSignal,
  Event,
  EventOrganizerContact,
  EventParticipationTier,
  EventSpeaker,
  EventSponsor,
} from "@/types";

const FORMAT_LABEL: Record<NonNullable<Event["format"]>, string> = {
  in_person: "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
};

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

function dateRange(start?: string, end?: string): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s ?? e ?? "Dates to be announced";
}

function locationLine(event: Event): string {
  const parts = [
    event.locationCity,
    event.locationState,
    event.locationCountry,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location to be announced";
}

// The signature motif — a traceable, monospaced citation chip.
function Cite({ href, label = "source" }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="citation">
      ↗ {label}
    </a>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="eyebrow mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Logistics({ event }: { event: Event }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Dates", value: dateRange(event.startDate, event.endDate) },
    { label: "Location", value: locationLine(event) },
    {
      label: "Format",
      value: event.format ? FORMAT_LABEL[event.format] : "Format to be announced",
    },
    {
      label: "Website",
      value: (
        <a
          href={event.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2 hover:opacity-80"
        >
          {event.website}
        </a>
      ),
    },
  ];
  const extraSources = event.sourceUrls.filter(
    (url) => url.toLowerCase() !== event.website.toLowerCase(),
  );
  return (
    <Section title="Logistics">
      <dl className="grid grid-cols-[7rem_1fr] gap-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {r.label}
            </dt>
            <dd className="break-words text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      {extraSources.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Additional sources
          </p>
          <ul className="space-y-1 text-sm">
            {extraSources.map((url) => (
              <li key={url}>
                <Cite href={url} label={url} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function TierCard({ tier }: { tier: EventParticipationTier }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 p-4">
      <p className="font-display text-sm font-semibold capitalize text-foreground">
        {tier.tier}
      </p>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">Cost: </span>
        <span className="tabular">{tier.cost ?? "Not published"}</span>
      </p>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">Deadline: </span>
        <span className="tabular">{formatDate(tier.deadline) ?? "Deadline unknown"}</span>
      </p>
      {tier.instructions && (
        <p className="text-sm text-muted-foreground">{tier.instructions}</p>
      )}
      <div className="mt-auto flex items-center gap-3 pt-1">
        {tier.applyUrl ? (
          <a
            href={tier.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand underline underline-offset-2 hover:opacity-80"
          >
            Apply →
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">No application link</span>
        )}
        <Cite href={tier.sourceUrl} />
      </div>
    </div>
  );
}

function Participation({ tiers }: { tiers: EventParticipationTier[] }) {
  return (
    <Section title="Participation options">
      {tiers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <TierCard key={`${t.tier}-${i}`} tier={t} />
          ))}
        </div>
      ) : (
        <Empty>No participation tiers published yet.</Empty>
      )}
    </Section>
  );
}

function Contacts({ contacts }: { contacts: EventOrganizerContact[] }) {
  return (
    <Section title="Organizer contacts">
      {contacts.length > 0 ? (
        <ul className="space-y-3">
          {contacts.map((c, i) => (
            <li key={`${c.name}-${i}`} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-foreground">{c.name}</span>
                {c.role && <span className="text-muted-foreground">{c.role}</span>}
                <Cite href={c.sourceUrl} />
              </div>
              <div className="flex flex-wrap gap-x-3 text-muted-foreground">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="underline underline-offset-2 hover:text-foreground">
                    {c.email}
                  </a>
                )}
                {c.linkedinUrl && (
                  <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    LinkedIn
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No organizer contacts found yet.</Empty>
      )}
    </Section>
  );
}

function Participants({
  speakers,
  sponsors,
}: {
  speakers: EventSpeaker[];
  sponsors: EventSponsor[];
}) {
  return (
    <Section title="Known participants">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Speakers
          </p>
          {speakers.length > 0 ? (
            <ul className="space-y-2">
              {speakers.map((s, i) => (
                <li key={`${s.name}-${i}`} className="text-sm">
                  <span className="font-medium text-foreground">{s.name}</span>
                  {(s.title || s.org) && (
                    <span className="text-muted-foreground">
                      {" — "}
                      {[s.title, s.org].filter(Boolean).join(", ")}
                    </span>
                  )}{" "}
                  <Cite href={s.sourceUrl} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No confirmed speakers yet.</Empty>
          )}
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Sponsors
          </p>
          {sponsors.length > 0 ? (
            <ul className="space-y-2">
              {sponsors.map((s, i) => (
                <li key={`${s.name}-${i}`} className="text-sm">
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.csrContact && (
                    <span className="text-muted-foreground">
                      {" — "}
                      {s.csrContact}
                    </span>
                  )}{" "}
                  <Cite href={s.sourceUrl} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No confirmed sponsors yet.</Empty>
          )}
        </div>
      </div>
    </Section>
  );
}

function DonorSignals({ signals }: { signals: DonorSignal[] }) {
  return (
    <Section title="Donor signals">
      <ul className="space-y-3">
        {signals.map((d, i) => (
          <li key={`${d.foundationName}-${i}`} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{d.foundationName}</span>
              {d.focusArea && (
                <span className="text-muted-foreground">{d.focusArea}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              {d.programOfficer && <span>{d.programOfficer}</span>}
              <Cite href={d.filingUrl} label="990 filing" />
              <Cite href={d.eventSourceUrl} label="event page" />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function EventDetail({ event }: { event: Event }) {
  return (
    <div className="min-h-screen w-full bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/events"
            className="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Back to events
          </Link>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground">
            {event.name}
          </h1>
          {event.causeAreaTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.causeAreaTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <Logistics event={event} />
        <Participation tiers={event.participationTiers} />
        <Contacts contacts={event.organizerContacts} />
        <Participants speakers={event.speakers} sponsors={event.sponsors} />
        {event.donorSignals.length > 0 && (
          <DonorSignals signals={event.donorSignals} />
        )}
      </div>
    </div>
  );
}
