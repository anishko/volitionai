-- Shared events corpus: the moat table (docs/NONPROFIT_EVENTS_PRD.md).
-- Every scrape any user triggers enriches this table for every future user.
-- All jsonb list columns hold arrays of objects that each carry their own
-- source_url (citation or no signal); shapes are typed in types/index.ts.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text not null,
  start_date date,
  end_date date,
  location_city text,
  location_state text,
  location_country text,
  format text check (format in ('in_person', 'virtual', 'hybrid')),
  cause_area_tags text[] not null default '{}',
  is_seed boolean not null default false,
  speakers jsonb not null default '[]',            -- [{name, title, org, linkedin_url, source_url}]
  sponsors jsonb not null default '[]',            -- [{name, csr_contact, linkedin_url, source_url}]
  organizer_contacts jsonb not null default '[]',  -- [{role, name, email, linkedin_url, source_url}]
  participation_tiers jsonb not null default '[]', -- [{tier, cost, deadline, apply_url, instructions, source_url, verified_at}]
  donor_signals jsonb not null default '[]',       -- [{foundation_name, program_officer, focus_area, filing_url, event_source_url}]
  timing_signals jsonb not null default '[]',      -- v1.5 stub: [{jurisdiction, session_start, source_url}]
  raw_scrape_data jsonb,                           -- full Firecrawl output, kept for re-processing; never sent to clients
  scrape_count integer not null default 1,         -- corpus-compounding metric
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  -- Dedupe key for merging seed rows with live-search finds.
  constraint events_dedupe_key unique nulls not distinct (website, name, start_date)
);

create index if not exists events_start_date_idx on public.events (start_date);
create index if not exists events_cause_area_tags_idx on public.events using gin (cause_area_tags);

alter table public.events enable row level security;

-- The corpus is readable by every signed-in org; writes happen only through
-- the server-side scrape pipeline using the service role (no write policies).
create policy "events: authenticated read"
  on public.events for select
  to authenticated
  using (true);
