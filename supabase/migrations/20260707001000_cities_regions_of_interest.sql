-- Split areas of interest into validated cities + controlled regions.
alter table public.nonprofit_profiles
  add column if not exists cities_of_interest text[] not null default '{}',
  add column if not exists regions_of_interest text[] not null default '{}';
