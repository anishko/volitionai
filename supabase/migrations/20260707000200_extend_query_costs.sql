-- Nonprofit Events: tag each cost row with the kind of run it belonged to
-- and the entity it ran for, so /api/costs/summary can roll up per feature
-- and per profile. Nullable, so existing Volition writes are unaffected.
-- run_type: "event_match" | "idea_generation" | "outreach_draft" | "event_scrape"
-- entity_id: profile_id for event_match runs

alter table public.query_costs
  add column if not exists run_type text,
  add column if not exists entity_id uuid;

create index if not exists query_costs_run_type_idx on public.query_costs (run_type);
create index if not exists query_costs_entity_id_idx on public.query_costs (entity_id);
