-- Event identity + multi-source citations (ADR-0006, PR5).
-- identity_key merges platform listings into one corpus row; source_urls
-- preserves every contributing URL for honest multi-citation cards.

alter table public.events
  add column if not exists identity_key text,
  add column if not exists source_urls text[] not null default '{}';

-- Backfill identity_key from existing rows before enforcing uniqueness.
-- Organizer-owned websites use org:domain:year; platform-only listings use
-- fuzzy:name-slug:year:city.
update public.events e
set identity_key = case
  when host not in (
    'eventbrite.com', 'meetup.com', 'lu.ma', 'luma.com',
    'facebook.com', 'linkedin.com', '10times.com', 'allevents.in'
  ) then 'org:' || host || ':' || coalesce(extract(year from e.start_date)::text, 'unknown')
  else 'fuzzy:' ||
    regexp_replace(lower(e.name), '[^a-z0-9]+', '-', 'g') || ':' ||
    coalesce(extract(year from e.start_date)::text, 'unknown') || ':' ||
    coalesce(regexp_replace(lower(e.location_city), '[^a-z0-9]+', '-', 'g'), 'unknown')
end
from (
  select
    id,
    lower(regexp_replace(substring(website from '://([^/]+)'), '^www\.', '')) as host
  from public.events
) hosts
where e.id = hosts.id
  and e.identity_key is null;

-- Seed rows cite themselves; live rows get their website as the first source.
update public.events
set source_urls = array[website]
where cardinality(source_urls) = 0;

create unique index if not exists events_identity_key_uidx
  on public.events (identity_key)
  where identity_key is not null;

alter table public.events
  drop constraint if exists events_dedupe_key;
