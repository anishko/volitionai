-- PR1 of the events-pipeline plan (docs/EVENTS_PIPELINE_PLAN.md; ADRs 0004,
-- 0005, 0007). Additive only - applied migrations are never edited.
--
-- Three pieces:
--   1. events.is_universal - sector-wide fundraising/management conferences
--      are relevant to any org once matching relaxes past strict cause
--      overlap (ADR-0007). Flagged in data, consumed by the cascade in code.
--   2. event_matches.match_tier - which relaxation-cascade tier produced the
--      match (ADR-0004). Drives the per-tier score penalty and the honest
--      "we broadened" UI label; a strict match and a virtual-floor match
--      must never be presented as the same thing.
--   3. match_runs - server-side run state (ADR-0005). Replaces the
--      localStorage guard that made a failed first run permanent: the seed
--      floor writes 'floor_ready', the live run advances it, and the client
--      polls this row instead of guessing.

-- 1. UNIVERSAL EVENTS --------------------------------------------------------

alter table public.events
  add column if not exists is_universal boolean not null default false;

-- The cascade scans the corpus filtered by tier; partial index keeps the
-- universal lookup cheap as live discovery grows the table.
create index if not exists events_is_universal_idx
  on public.events (is_universal) where is_universal;

-- 2. MATCH TIER --------------------------------------------------------------

-- Existing rows predate the cascade and were produced by the strict filter,
-- so 'strict' is the correct backfill, not just a convenient default.
alter table public.event_matches
  add column if not exists match_tier text not null default 'strict';

alter table public.event_matches
  drop constraint if exists event_matches_match_tier_check;
alter table public.event_matches
  add constraint event_matches_match_tier_check
  check (match_tier in ('strict', 'geo_relaxed', 'cause_broadened', 'virtual_floor'));

-- 3. MATCH RUN STATE ---------------------------------------------------------

-- One row per match run. status transitions:
--   floor_ready -> live_running -> done | failed
-- notices carries the run's honest degradation messages (source down, budget
-- stop, ...) so the UI can surface them; never silent (CLAUDE.md rule 6).
create table if not exists public.match_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nonprofit_profiles (id) on delete cascade,
  status text not null default 'floor_ready'
    check (status in ('floor_ready', 'live_running', 'done', 'failed')),
  notices jsonb not null default '[]',   -- string[]
  error text,                            -- set only when status = 'failed'
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- The poller asks "latest run for my profile"; index matches that access path.
create index if not exists match_runs_profile_started_idx
  on public.match_runs (profile_id, started_at desc);

alter table public.match_runs enable row level security;

-- Runs are created and advanced only by the server-side pipeline (service
-- role); users read their own run state to drive the progress screen.
create policy "match_runs: owner select"
  on public.match_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );
