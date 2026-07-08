// Event detail view (issue #6). Renders the five sections a nonprofit needs to
// decide on an event — logistics, participation options, organizer contacts,
// known participants, donor signals — from the shared events corpus. Every
// sourced field links back to its citation; empty sections degrade to a quiet
// placeholder rather than a broken layout, and donor signals only appear when
// the corpus actually carries them.
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

function SourceLink({ href, label = "source" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 underline underline-offset-2 dark:text-blue-400"
    >
      {label}
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
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400 dark:text-zinc-500">{children}</p>;
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
          className="text-blue-600 underline underline-offset-2 dark:text-blue-400"
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
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">
              {r.label}
            </dt>
            <dd className="break-words text-zinc-900 dark:text-zinc-100">
              {r.value}
            </dd>
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
                <SourceLink href={url} label={url} />
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
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
        {tier.tier}
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        <span className="text-zinc-500 dark:text-zinc-400">Cost: </span>
        {tier.cost ?? "Not published"}
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        <span className="text-zinc-500 dark:text-zinc-400">Deadline: </span>
        {formatDate(tier.deadline) ?? "Deadline unknown"}
      </p>
      {tier.instructions && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {tier.instructions}
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 pt-1">
        {tier.applyUrl ? (
          <a
            href={tier.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
          >
            Apply →
          </a>
        ) : (
          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            No application link
          </span>
        )}
        <SourceLink href={tier.sourceUrl} />
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
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {c.name}
                </span>
                {c.role && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {c.role}
                  </span>
                )}
                <SourceLink href={c.sourceUrl} />
              </div>
              <div className="flex flex-wrap gap-x-3 text-zinc-600 dark:text-zinc-300">
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="underline underline-offset-2"
                  >
                    {c.email}
                  </a>
                )}
                {c.linkedinUrl && (
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
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
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Speakers
          </p>
          {speakers.length > 0 ? (
            <ul className="space-y-2">
              {speakers.map((s, i) => (
                <li key={`${s.name}-${i}`} className="text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                  {(s.title || s.org) && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" — "}
                      {[s.title, s.org].filter(Boolean).join(", ")}
                    </span>
                  )}{" "}
                  <SourceLink href={s.sourceUrl} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No confirmed speakers yet.</Empty>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Sponsors
          </p>
          {sponsors.length > 0 ? (
            <ul className="space-y-2">
              {sponsors.map((s, i) => (
                <li key={`${s.name}-${i}`} className="text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                  {s.csrContact && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" — "}
                      {s.csrContact}
                    </span>
                  )}{" "}
                  <SourceLink href={s.sourceUrl} />
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
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {d.foundationName}
              </span>
              {d.focusArea && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  {d.focusArea}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 text-zinc-600 dark:text-zinc-300">
              {d.programOfficer && <span>{d.programOfficer}</span>}
              <SourceLink href={d.filingUrl} label="990 filing" />
              <SourceLink href={d.eventSourceUrl} label="event page" />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function EventDetail({ event }: { event: Event }) {
  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/events"
            className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            ← Back to events
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {event.name}
          </h1>
          {event.causeAreaTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.causeAreaTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
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
