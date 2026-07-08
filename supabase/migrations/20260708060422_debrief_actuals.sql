-- Phase 7 (Event Debriefs, v1.5): add the "actual" side of the planned-vs-actual
-- debrief. The event_debriefs table (see 20260707000700) shipped with only
-- worth_it + notes; this ALTER adds the structured actuals the debrief form
-- captures. Additive and nullable only — worth_it, notes, the RLS policies, and
-- grants are intentionally left untouched. These are the USER's own reported
-- numbers (not researched), so no source_url columns apply (PRD rule 1 covers
-- only figures we researched; the sourced PLANNED side lives on event_plans).
alter table public.event_debriefs
  add column if not exists outcome text
    check (outcome in ('attended', 'skipped')),          -- attend/skip outcome
  add column if not exists actual_spend_usd numeric,      -- actual money spent
  add column if not exists leads_gained integer,          -- leads captured at the event
  add column if not exists contacts_gained integer;       -- contacts/connections made
