-- Onboarding geography: HQ + areas of interest (separate from local/regional detail).
alter table public.nonprofit_profiles
  add column if not exists headquarters text,
  add column if not exists areas_of_interest text;
