-- Revoke excessive table-level grants from the API roles (anon, authenticated).
--
-- WHY: Supabase's blanket default privileges hand every new public table a set
-- of privileges the app never uses and that sit OUTSIDE row-level security:
--   * TRUNCATE  — bypasses RLS entirely. A truncate ignores every row policy and
--                 empties the whole table in one statement; RLS cannot stop it.
--                 This is the dangerous one now that real user data is incoming.
--   * REFERENCES — lets a role create foreign keys pointing at the table.
--   * TRIGGER    — lets a role attach triggers to the table.
--   * MAINTAIN   — (PG17+) lets a role run VACUUM/ANALYZE/REINDEX/CLUSTER/REFRESH
--                  MATERIALIZED VIEW on the table. Also outside RLS; clients have
--                  no reason to hold it. Verified present: server is PostgreSQL
--                  17.6, and the audit ACLs show 'm' granted to anon/authenticated.
-- RLS is the ROW guard; these are TABLE/SCHEMA privileges it does not cover.
-- The DML grants (SELECT/INSERT/UPDATE/DELETE) are deliberately shaped per table
-- and per role (e.g. anon-SELECT only on events; no authenticated DELETE on
-- event_debriefs / outreach_drafts; query_costs readable by service_role only)
-- and are LEFT EXACTLY AS-IS. service_role is untouched — it runs the
-- server-side pipeline and legitimately holds the full set.
--
-- Idempotent: re-running revokes what is present and no-ops on the rest.
-- NOTE (PG version): MAINTAIN below requires PostgreSQL 17+. This project is on
-- 17.6; on an older server these statements would error and MAINTAIN must be removed.

-- ── Part 1: revoke on all EXISTING public tables ──────────────────────────
-- Driven off information_schema.role_table_grants so we only touch (table, role)
-- pairs that actually hold one of the standard privileges today. (MAINTAIN is a
-- non-standard PG privilege and is not reported by information_schema, but every
-- affected pair also holds TRUNCATE/REFERENCES/TRIGGER, so the loop catches them
-- all and the REVOKE clause strips MAINTAIN too.)
do $$
declare g record;
begin
  for g in
    select distinct table_name, grantee
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  loop
    execute format(
      'revoke truncate, references, trigger, maintain on public.%I from %I',
      g.table_name, g.grantee
    );
  end loop;
end $$;

-- ── Part 2: stop FUTURE tables from re-acquiring these via default privileges ─
-- The excessive grants come from ALTER DEFAULT PRIVILEGES, so without this the
-- next `create table` re-grants them and we'd re-run this migration every phase.
-- pg_default_acl showed two owners of table default-ACLs in public:
--   * postgres       → anon = Dxtm, authenticated = arwDxtm  ← the source of the
--                       excessive grants in the audit; reversed below.
--   * supabase_admin → arwdDxtm to all three roles.
-- We pin the revoke to FOR ROLE postgres explicitly. db push connects AS postgres,
-- so this is a self-alter — no role-membership problem, and we let it hard-fail
-- if it ever can't apply (no exception handler).
--
-- supabase_admin's default ACL is intentionally NOT touched: the migration role
-- (postgres) is not a member of supabase_admin and cannot alter its defaults —
-- and it doesn't need to. Default privileges apply based on the role that CREATES
-- an object; our migrations create every app table AS postgres, so app tables
-- inherit postgres's defaults (fixed here), never supabase_admin's. supabase_admin's
-- defaults only affect objects supabase_admin itself creates (Supabase-managed
-- internals), which are out of scope for this app hardening.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
