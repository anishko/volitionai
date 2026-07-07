-- Event matches: one row per (profile, event) recommendation produced by the
-- matching pipeline. evidence is the citation array backing why_attend and
-- donor_signal_callout; the validator enforces at least one sourced claim
-- before a match is written (citation or no signal).

create table if not exists public.event_matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nonprofit_profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  match_score integer not null check (match_score between 0 and 100),
  why_attend text,
  donor_signal_callout text,
  evidence jsonb not null default '[]',  -- [{claim, source_url}]
  status text not null default 'recommended'
    check (status in ('recommended', 'saved', 'dismissed')),
  dismissed_reason text,                 -- v2 feedback loop; collected now
  created_at timestamptz not null default now(),
  unique (profile_id, event_id)
);

create index if not exists event_matches_profile_id_idx on public.event_matches (profile_id);
create index if not exists event_matches_event_id_idx on public.event_matches (event_id);

alter table public.event_matches enable row level security;

-- Matches are created by the server-side pipeline (service role). Users read
-- their own matches and update status (save / dismiss) via PATCH /api/matches.
create policy "matches: owner select"
  on public.event_matches for select
  to authenticated
  using (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "matches: owner update"
  on public.event_matches for update
  to authenticated
  using (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );
