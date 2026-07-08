-- ============================================================================
-- scripts/cleanup-test-data.sql
-- Purpose: remove the pipeline-acceptance TEST data (synthetic user, TEST
--          profile, and all of its dependent rows) while leaving the seed
--          events corpus completely intact.
--
-- HARD RULE: the seed corpus survives. Every events row with is_seed = true
--            stays, no exceptions. This script issues NO delete against the
--            events table at all (see the "events" note in STEP 2).
--
-- HOW TO RUN: paste into the Supabase SQL editor (runs as postgres). Run
--   STEP 0 and STEP 1 (read-only) FIRST and eyeball the numbers, THEN run the
--   STEP 2 transaction, THEN run STEP 3 and confirm every test-scoped count is
--   0 and the seed count is unchanged (51). Nothing here is destructive until
--   you run STEP 2.
--
-- WHEN TO RUN: only AFTER the first real onboarding has succeeded. Until then
--   this TEST data is the only demo-able data in the database — do not run this
--   before you have real data to fall back on.
--
-- TARGETS (both must resolve to exactly one row — see STEP 0):
--   * auth user   : email    = 'test-pipeline@volition.local'
--   * TEST profile: org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
--     (the dash is an em-dash, U+2014 — if STEP 0 returns 0 rows, your copy may
--      have a different dash; adjust the literal before proceeding.)
--
-- SCOPING ANCHOR: every profile-scoped delete below is keyed on the TEST
--   profile's org_name, NOT on is_seed and NOT on "all non-seed rows", so a
--   real user's data (which exists by the time this runs) is never touched.
-- ============================================================================


-- ============================================================================
-- STEP 0 — TARGET GUARD (read-only). Confirm exactly ONE user and ONE profile
-- are targeted, and that the profile belongs to that user. If either returns
-- 0 or >1 rows, STOP and fix the literals before running STEP 2.
-- ============================================================================

-- expect: exactly 1 row
select id as test_user_id, email
from auth.users
where email = 'test-pipeline@volition.local';

-- expect: exactly 1 row; user_id should equal the id above
select id as test_profile_id, user_id, org_name
from public.nonprofit_profiles
where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)';


-- ============================================================================
-- STEP 1 — PRE-DELETE COUNTS (read-only). Note each number; compare to STEP 3.
-- The test-scoped counts should drop to 0; the seed count MUST stay the same.
-- ============================================================================

-- outreach_drafts owned by the TEST profile's matches
select count(*) as outreach_drafts_pre
from public.outreach_drafts
where match_id in (
  select id from public.event_matches
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);

-- event_debriefs owned by the TEST profile's plans (expected 0 — no debrief UI
-- ships yet, so the acceptance run almost certainly created none; scoped anyway)
select count(*) as event_debriefs_pre
from public.event_debriefs
where plan_id in (
  select id from public.event_plans
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);

-- event_matches for the TEST profile (this is the "14 test events" join — see
-- the events note in STEP 2: these rows are the MATCHES, not the events)
select count(*) as event_matches_pre
from public.event_matches
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);

-- event_plans for the TEST profile
select count(*) as event_plans_pre
from public.event_plans
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);

-- the TEST profile itself (expect 1)
select count(*) as nonprofit_profiles_pre
from public.nonprofit_profiles
where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)';

-- the synthetic auth user (expect 1)
select count(*) as auth_users_pre
from auth.users
where email = 'test-pipeline@volition.local';

-- SEED CORPUS INVARIANT — MUST be identical before and after (expect 51)
select count(*) as seed_events_pre
from public.events
where is_seed = true;

-- DIAGNOSTIC — non-seed events (this script does NOT delete any of these; see
-- the events note in STEP 2). Expected 0 for the acceptance run (Firecrawl was
-- unconfigured, so no pages were scraped and no non-seed events were inserted).
-- If this returns rows, inspect them by hand before deciding anything.
select id, name, website, is_seed, created_at
from public.events
where is_seed = false
order by created_at;

-- OPTIONAL DIAGNOSTIC — cost telemetry linked to the TEST profile. query_costs
-- rows carry entity_id = TEST profile_id for every run type. entity_id is a
-- plain uuid (NOT a foreign key), so these rows are NOT cascade-deleted with
-- the profile; they persist unless you run the OPTIONAL step 4b. Note this
-- count/total if you plan to compare afterward (post-check needs the captured
-- profile UUID — see STEP 3, since org_name no longer resolves once deleted).
select
  count(*)            as query_costs_test_pre,
  coalesce(sum(usd), 0) as query_costs_test_usd_pre
from public.query_costs
where entity_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);


-- ============================================================================
-- STEP 2 — DELETE (one transaction, FK-safe leaf -> root order).
--
-- Every FK below is ON DELETE CASCADE, so deleting the auth user alone would
-- cascade the rest; we delete explicitly in order anyway so each table's row
-- count is individually verifiable (STEP 1 vs STEP 3).
--
-- Deletion order (children before parents):
--   outreach_drafts  -> event_debriefs -> event_matches -> event_plans
--   -> nonprofit_profiles -> auth.users
--
-- PER-TABLE ASSUMPTIONS (what we delete and why it is only test data):
--   * outreach_drafts  : rows whose match_id belongs to the TEST profile's
--                        matches. Assumption: outreach drafts exist only for
--                        the TEST profile's matches (created by scripts/
--                        test-outreach.ts against the acceptance matches).
--   * event_debriefs   : rows whose plan_id belongs to the TEST profile's
--                        plans. Assumption: none exist (no debrief UI ships),
--                        scoped defensively regardless.
--   * event_matches    : rows for the TEST profile. Assumption: these are the
--                        acceptance run's recommendations.
--   * event_plans      : rows for the TEST profile. Assumption: any plans came
--                        from the acceptance "Add to Plan".
--   * nonprofit_profiles: the single TEST profile row (org_name match).
--   * auth.users       : the single synthetic acceptance user (email match).
--                        Cascades its auth.identities / sessions automatically.
--   * query_costs      : OPTIONAL, off by default (step 4b, commented). Every
--                        test run wrote entity_id = TEST profile_id (all run
--                        types: profile_extraction / event_match / outreach_
--                        draft). entity_id is NOT a foreign key, so these cost
--                        rows do NOT cascade with the profile — they orphan
--                        harmlessly and stay unless you uncomment step 4b. You
--                        decide at run time whether the cost telemetry stays.
--   * events           : NOT DELETED. Assumption: the events the acceptance run
--                        matched are SEED rows (is_seed = true) — Firecrawl was
--                        unconfigured during acceptance, so the scrape stage
--                        inserted zero new event rows; the pipeline matched
--                        against the permanent 51-row seed corpus, it did not
--                        create events. The events table also has no owner /
--                        created-by column, so a test-created row could not be
--                        distinguished from a real user's discovered row, and a
--                        real onboarding has run by the time this executes.
--                        Blanket-deleting is_seed = false would therefore risk
--                        the real corpus and is deliberately refused. If the
--                        STEP 1 diagnostic surfaced a non-seed row you have
--                        confirmed by hand is test residue, remove it with the
--                        commented one-off at the end of STEP 2 — by explicit
--                        id, never in bulk.
-- ============================================================================

begin;

-- 1. outreach_drafts (child of event_matches)
delete from public.outreach_drafts
where match_id in (
  select id from public.event_matches
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);

-- 2. event_debriefs (child of event_plans)
delete from public.event_debriefs
where plan_id in (
  select id from public.event_plans
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);

-- 3. event_matches (child of nonprofit_profiles + events; parent of outreach_drafts)
delete from public.event_matches
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);

-- 4. event_plans (child of nonprofit_profiles + events; parent of event_debriefs)
delete from public.event_plans
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);

-- 4b. OPTIONAL — cost telemetry for the TEST profile. LEFT COMMENTED by default:
--     the cost ledger is kept, and its rows orphan harmlessly once the profile
--     is gone (entity_id is not a foreign key). UNCOMMENT to purge it instead.
--     Must run BEFORE step 5 so the org_name anchor still resolves the id.
--     entity_id = TEST profile_id covers every test run type
--     (profile_extraction / event_match / outreach_draft all set it).
-- delete from public.query_costs
-- where entity_id = (
--   select id from public.nonprofit_profiles
--   where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
-- );

-- 5. nonprofit_profiles (child of auth.users; parent of matches + plans)
delete from public.nonprofit_profiles
where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)';

-- 6. auth.users (root). Cascades auth.identities / auth.sessions for this user.
--    Alternatively delete this user from the Supabase Auth UI instead.
delete from auth.users
where email = 'test-pipeline@volition.local';

-- events: intentionally untouched (see the assumptions block above).
--
-- OPTIONAL, MANUAL, one row at a time — ONLY for a non-seed row you inspected
-- in STEP 1 and confirmed is test residue (NEVER a real user's event). Never
-- delete by is_seed in bulk. Uncomment and fill in the explicit id:
-- delete from public.events where id = '<paste-exact-uuid-here>' and is_seed = false;

-- Review the row counts the six deletes above reported. If anything looks
-- wrong, run  rollback;  instead of the commit.
commit;


-- ============================================================================
-- STEP 3 — POST-DELETE COUNTS (read-only). Every test-scoped count should be 0;
-- seed_events_post MUST equal seed_events_pre (51).
-- ============================================================================

select count(*) as outreach_drafts_post
from public.outreach_drafts
where match_id in (
  select id from public.event_matches
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);  -- expect 0 (and the subquery itself is now empty)

select count(*) as event_debriefs_post
from public.event_debriefs
where plan_id in (
  select id from public.event_plans
  where profile_id = (
    select id from public.nonprofit_profiles
    where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
  )
);  -- expect 0

select count(*) as event_matches_post
from public.event_matches
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);  -- expect 0

select count(*) as event_plans_post
from public.event_plans
where profile_id = (
  select id from public.nonprofit_profiles
  where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)'
);  -- expect 0

select count(*) as nonprofit_profiles_post
from public.nonprofit_profiles
where org_name = 'TEST — Liberty Legal Aid (pipeline acceptance)';  -- expect 0

select count(*) as auth_users_post
from auth.users
where email = 'test-pipeline@volition.local';  -- expect 0

-- SEED CORPUS INVARIANT — expect 51 (unchanged from STEP 1)
select count(*) as seed_events_post
from public.events
where is_seed = true;

-- OPTIONAL — query_costs post-check. The profile row is gone, so the org_name
-- anchor no longer resolves; paste the TEST profile UUID captured in STEP 0.
-- If you uncommented step 4b, expect 0; if you left it, expect the STEP 1
-- number (rows now orphaned by entity_id, which is harmless).
-- select count(*) as query_costs_test_post
-- from public.query_costs
-- where entity_id = '<paste TEST profile UUID from STEP 0>';
