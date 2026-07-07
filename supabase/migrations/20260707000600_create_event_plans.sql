-- Event plans: participation checklists with source-linked deadlines.
-- checklist items may carry calendar_event_id after the user explicitly
-- syncs to Google Calendar (sync is always user-initiated; see PRD).

create table if not exists public.event_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nonprofit_profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  participation_tier text,
  checklist jsonb not null default '[]',  -- [{task, deadline, deadline_source_url, completed, calendar_event_id}]
  calendar_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_plans_profile_id_idx on public.event_plans (profile_id);
create index if not exists event_plans_event_id_idx on public.event_plans (event_id);

create trigger event_plans_set_updated_at
  before update on public.event_plans
  for each row execute function public.set_updated_at();

alter table public.event_plans enable row level security;

create policy "plans: owner select"
  on public.event_plans for select
  to authenticated
  using (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "plans: owner insert"
  on public.event_plans for insert
  to authenticated
  with check (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "plans: owner update"
  on public.event_plans for update
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

create policy "plans: owner delete"
  on public.event_plans for delete
  to authenticated
  using (
    exists (
      select 1 from public.nonprofit_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );
