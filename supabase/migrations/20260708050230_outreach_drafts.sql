-- Phase 5 outreach drafting (docs/NONPROFIT_EVENTS_PRD.md → "Outreach drafting").
-- One row per generated draft. Drafts are prepared LOCALLY in the org's voice;
-- the system never sends anything ("prep the send" pattern). evidence carries the
-- match's cited claims the draft drew on (citation or no signal).

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.event_matches (id) on delete cascade,
  draft_type text not null
    check (draft_type in ('sponsor_pitch', 'cfp_abstract', 'intro_email')),
  body text not null,
  evidence jsonb not null default '[]',  -- [{claim, source_url}] the draft drew on
  model_route text not null default 'local'
    check (model_route in ('local', 'cloud', 'fallback:cloud')),
  created_at timestamptz not null default now()
);

create index if not exists outreach_drafts_match_id_idx on public.outreach_drafts (match_id);

alter table public.outreach_drafts enable row level security;

-- Owner-scoped via match → profile → user (same pattern as event_matches /
-- event_debriefs). Drafts are written server-side and read back by the owner.
create policy "outreach_drafts: owner select"
  on public.outreach_drafts for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_matches m
      join public.nonprofit_profiles p on p.id = m.profile_id
      where m.id = match_id and p.user_id = (select auth.uid())
    )
  );

create policy "outreach_drafts: owner insert"
  on public.outreach_drafts for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_matches m
      join public.nonprofit_profiles p on p.id = m.profile_id
      where m.id = match_id and p.user_id = (select auth.uid())
    )
  );

-- Table guard (grants) alongside the row guard (RLS). service_role runs the
-- server-side drafting/persistence; authenticated reads + inserts its own drafts.
grant all on public.outreach_drafts to service_role;
grant select, insert on public.outreach_drafts to authenticated;
