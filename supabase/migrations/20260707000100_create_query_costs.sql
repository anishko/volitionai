-- Volition cost ledger: one row per CostEvent (types/cost.ts).
-- The hackathon build kept cost events in-memory per run; this table is the
-- durable ledger behind the Cost Receipt and the monthly cost view.
-- Column names mirror the CostEvent fields (snake_case).

create table if not exists public.query_costs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  stage text not null,
  provider text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  unit_count integer,
  usd numeric(12, 6) not null default 0,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists query_costs_run_id_idx on public.query_costs (run_id);
create index if not exists query_costs_created_at_idx on public.query_costs (created_at);

-- Cost rows are written and read server-side with the service role only.
-- RLS is enabled with no policies so anon/authenticated clients get nothing.
alter table public.query_costs enable row level security;
