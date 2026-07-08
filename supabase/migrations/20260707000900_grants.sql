-- Table-privilege grants for the PostgREST roles.
--
-- ROOT CAUSE (one line): the base migrations 000100–000800 create tables and RLS
-- POLICIES but never GRANT table privileges, and this project lacks the
-- dashboard's default-privilege grants — so service_role/anon/authenticated hit
-- the table guard (SQLSTATE 42501) before RLS is ever evaluated. RLS is the ROW
-- guard; GRANTs are the TABLE guard. Both are required. This migration adds the
-- missing table guard with least privilege per role, and ALTER DEFAULT
-- PRIVILEGES so future tables inherit it (so we fix it at the root, not per-table).

grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access (server-side pipeline; bypasses RLS but still needs grants).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- authenticated: only what the app does on its RLS-protected tables (RLS still
-- scopes rows to the owner). select/insert/update per the app's write paths;
-- delete is intentionally NOT granted here (no app delete path yet — add narrowly if one lands).
grant select, insert, update on public.nonprofit_profiles to authenticated;
grant select                 on public.events              to authenticated;
grant select, update         on public.event_matches       to authenticated;
grant select, insert, update on public.event_plans         to authenticated;
grant select, insert, update on public.event_debriefs      to authenticated;
-- (outreach_drafts is in the PRD data model but has no migration yet — no grant until it exists.)
-- query_costs has no client policy — server-side (service_role) only; no grant to authenticated.

-- anon: read the public events corpus ONLY. Nothing else — blanket-granting anon
-- would undermine defense in depth even with RLS in place.
grant select on public.events to anon;

-- Future tables inherit the same table guard (created by this migration's owner role).
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines  to service_role;
alter default privileges in schema public grant select, insert, update on tables to authenticated;
