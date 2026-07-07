# Supabase schema

Migrations for the Nonprofit Events feature (docs/NONPROFIT_EVENTS_PRD.md) plus the durable `query_costs` ledger.
They are plain SQL and run in filename order.

`seed.sql` loads the hand-curated events corpus (51 recurring nonprofit and philanthropy conferences, 9 cause areas).
It is idempotent: it upserts on the `(website, name, start_date)` dedupe key and never touches enrichment-owned columns (`speakers`, `sponsors`, `participation_tiers`, `donor_signals`, `raw_scrape_data`, `scrape_count`), so re-seeding cannot clobber scraped data.
The Supabase CLI runs it automatically on `supabase db reset`; apply it manually with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql`.
Refresh cadence is annual: update dates to the next edition and re-run.

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
