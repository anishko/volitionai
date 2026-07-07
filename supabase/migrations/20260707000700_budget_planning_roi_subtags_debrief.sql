-- Follow-up migration for PRD v3 (design partner #2: civil-rights / legal-reform
-- nonprofit with a hard annual budget cap). Additive only — the 000100–000600
-- migrations are already applied, so this ALTERs/creates rather than editing them.
-- See docs/NONPROFIT_EVENTS_PRD.md → "Budget-capped annual planning", "ROI fields",
-- "Cause taxonomy", "Post-event debrief (v1.5)".

-- 1. BUDGET-CAPPED PLANNING ------------------------------------------------

-- Profile carries the annual conference budget the plan must fit under.
alter table public.nonprofit_profiles
  add column if not exists annual_budget_cap numeric,       -- nullable: many orgs plan without a hard cap
  add column if not exists budget_period text;              -- e.g. "2027" (fiscal/calendar period label)

-- Plan entries carry the two cost components the annual plan totals against
-- the cap. registration_cost is a SOURCED snapshot of the chosen
-- participation tier's cost (events.participation_tiers already carries
-- {cost, source_url, verified_at} — citation or no number); estimated_travel_cost
-- is an ESTIMATE and must always be labeled "estimate" in the UI, never cited.
alter table public.event_plans
  add column if not exists budget_period text,                        -- groups plans into one annual plan
  add column if not exists registration_cost numeric,                 -- sourced from the tier's cited cost
  add column if not exists registration_cost_source_url text,         -- the citation for registration_cost
  add column if not exists registration_cost_verified_at timestamptz, -- when that cost was verified
  add column if not exists estimated_travel_cost numeric;             -- ESTIMATE only; UI must label it so

create index if not exists event_plans_budget_period_idx
  on public.event_plans (profile_id, budget_period);

-- 2. ROI FIELDS ON EVENTS --------------------------------------------------

-- Certificates / CE credits offered, scraped where available. Each entry is
-- {type, source_url} — citation or no badge. Powers the "certificates" card
-- badge and ROI-aware matching (virtual events treated first-class in the
-- matcher when the profile signals budget sensitivity — enforced in code).
alter table public.events
  add column if not exists certificates_offered jsonb not null default '[]';
  -- [{type, source_url}]

-- 3. CAUSE TAXONOMY SUB-TAGS -----------------------------------------------

-- Sub-tags expand the civil-liberties bucket (criminal legal reform, child
-- welfare, fourth amendment / over-policing, exoneration, eminent domain,
-- homeless defense). The matching filter operates on sub-tags when present,
-- falling back to top-level cause tags otherwise.
alter table public.nonprofit_profiles
  add column if not exists cause_sub_tags text[] not null default '{}';
alter table public.events
  add column if not exists cause_sub_tags text[] not null default '{}';

create index if not exists events_cause_sub_tags_idx
  on public.events using gin (cause_sub_tags);

-- 4. POST-EVENT DEBRIEF (v1.5 — schema now, no UI yet) ---------------------

-- One debrief per plan: was attending worth it? Feeds the v2 feedback loop.
-- No UI in v1.5; see MOCKED.md.
create table if not exists public.event_debriefs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.event_plans (id) on delete cascade,
  worth_it integer check (worth_it between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists event_debriefs_plan_id_idx on public.event_debriefs (plan_id);

alter table public.event_debriefs enable row level security;

-- Owner-scoped via plan → profile → user (same pattern as event_plans).
create policy "debriefs: owner select"
  on public.event_debriefs for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_plans pl
      join public.nonprofit_profiles p on p.id = pl.profile_id
      where pl.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "debriefs: owner insert"
  on public.event_debriefs for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_plans pl
      join public.nonprofit_profiles p on p.id = pl.profile_id
      where pl.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "debriefs: owner update"
  on public.event_debriefs for update
  to authenticated
  using (
    exists (
      select 1
      from public.event_plans pl
      join public.nonprofit_profiles p on p.id = pl.profile_id
      where pl.id = plan_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.event_plans pl
      join public.nonprofit_profiles p on p.id = pl.profile_id
      where pl.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "debriefs: owner delete"
  on public.event_debriefs for delete
  to authenticated
  using (
    exists (
      select 1
      from public.event_plans pl
      join public.nonprofit_profiles p on p.id = pl.profile_id
      where pl.id = plan_id and p.user_id = (select auth.uid())
    )
  );
