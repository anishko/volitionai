-- Nonprofit org profile: the persistent, structured profile extracted at
-- onboarding (docs/NONPROFIT_EVENTS_PRD.md, "Data model"). One profile per
-- user for v1 (GET /api/nonprofit/profile is singular), enforced by
-- unique (user_id).
-- Raw uploads are never stored: only extracted jsonb facts persist.

-- Shared trigger used by every table with an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.nonprofit_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_name text not null,
  website text,
  cause_areas text[] not null default '{}',
  geography_focus text
    check (geography_focus in ('local', 'regional', 'national', 'international')),
  geography_detail text,
  org_size text,
  current_donor_mix text[] not null default '{}',
  target_donor_type text[] not null default '{}',
  primary_goal text,
  open_ended_notes text,
  extracted_profile jsonb,  -- LLM-structured profile used for matching
  voice_profile jsonb,      -- tone/voice facts from past-content upload
  internal_facts jsonb,     -- "Bring Your Numbers" extracted facts, never raw data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger nonprofit_profiles_set_updated_at
  before update on public.nonprofit_profiles
  for each row execute function public.set_updated_at();

alter table public.nonprofit_profiles enable row level security;

create policy "profiles: owner select"
  on public.nonprofit_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: owner insert"
  on public.nonprofit_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles: owner update"
  on public.nonprofit_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "profiles: owner delete"
  on public.nonprofit_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);
