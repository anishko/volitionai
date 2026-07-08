-- Table-level grants for the Supabase API roles. RLS (enabled on every
-- table) decides WHICH rows a user may touch; these grants decide whether
-- the PostgREST roles may touch the tables at all. Managed Supabase
-- normally inherits them from default privileges, but that did not happen
-- on the live project (every role got 42501 "permission denied", surfacing
-- as PGRST205 while the schema cache was stale), and the direct-psql path
-- in supabase/README.md never provides them. Explicit grants make the
-- migrations self-contained on any Postgres 15+ database.
-- Grants mirror the RLS policies: no policy, no grant.

-- service_role bypasses RLS but still needs table-level grants.
grant select, insert, update, delete on table public.nonprofit_profiles to service_role;
grant select, insert, update, delete on table public.events to service_role;
grant select, insert, update, delete on table public.event_matches to service_role;
grant select, insert, update, delete on table public.event_plans to service_role;
grant select, insert, update, delete on table public.query_costs to service_role;

-- authenticated: least privilege, matching the owner-scoped policies.
grant select, insert, update, delete on table public.nonprofit_profiles to authenticated;
grant select on table public.events to authenticated;
grant select, update on table public.event_matches to authenticated;
grant select, insert, update, delete on table public.event_plans to authenticated;

-- query_costs is service-role only (RLS enabled, no policies) and anon has
-- no table access at all: every query path requires a signed-in user.
