# Supabase schema

Migrations for the Nonprofit Events feature (docs/NONPROFIT_EVENTS_PRD.md) plus the durable `query_costs` ledger.
They are plain SQL and run in filename order.

## Applying

With the Supabase CLI (after `supabase init` and `supabase link --project-ref <ref>`):

```sh
supabase db push
```

Or directly against any Postgres 15+ database:

```sh
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

## Notes

- `nonprofit_profiles`, `event_matches`, and `event_plans` are per-user tables with owner-scoped RLS via `auth.uid()`.
- `events` is the shared corpus: readable by any authenticated user, written only by the server-side pipeline with the service role.
- `query_costs` has RLS enabled with no policies: service-role access only.
- The `events_dedupe_key` constraint uses `unique nulls not distinct` (Postgres 15+) so seed rows and live-search finds merge on (website, name, start_date) even when start_date is unknown.
