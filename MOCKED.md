# Mocked vs Real (judges will ask — keep honest and current)

## Cached demo fallback (real prior output — both pipelines)
- The cached fallback serves **real prior pipeline output**, not hand-written
  content. A successful live run is captured to a fixture file, timestamped,
  and served when `DEMO_FALLBACK=1`. Every card went through the same
  citation validator as a live run (real, fetched URLs).

**Legacy ideas pipeline** (`/` + `/api/ideas`):
  - Capture: `CAPTURE_FIXTURE=1` on a POST to `/api/ideas`
  - Serve: `DEMO_FALLBACK=1` env var; also `GET /api/ideas?cached=1&persona=slug`
  - Fixture files: `fixtures/demo/<persona>.json`
  - Captured personas: `crestview-trading-club`, `camino-coffee`, `liberty-legal-aid`

**Nonprofit events pipeline** (`/events` + `/api/events/match`):
  - Capture: `CAPTURE_EVENT_FIXTURE=1` on a POST to `/api/events/match`
    (runs live, captures result to `fixtures/events/<org-slug>.json`)
  - Serve: `DEMO_FALLBACK=1` env var; GET and POST both serve the fixture
    and return `cached: true`. If no fixture exists yet, falls through to live.
  - Fixture files: `fixtures/events/<slug>.json`
  - **Captured personas: none yet** — run a live match with `CAPTURE_EVENT_FIXTURE=1`
    before the demo, then add the static import to `lib/events/fixtures.ts` and redeploy.

## Structured event APIs (best-effort — honest degradation)
- **Eventbrite** (`lib/events/sources/eventbrite.ts`, wraps
  `lib/data/eventbrite.ts`) and **Meetup** (`lib/events/sources/meetup.ts`,
  wraps `lib/data/meetup.ts`) sit behind the PR4 source router
  (`lib/events/sources/router.ts`). Both are **best-effort enrichment**, not a
  feed guarantee — Eventbrite's public event-search endpoint is largely
  retired/restricted (404 → "source unavailable" notice, empty contribution,
  run continues); Meetup's free GraphQL API may reject or rate-limit (notice +
  empty). Every adapter call still emits a CostEvent (Eventbrite/Meetup at
  $0). Unconfigured keys degrade cleanly: `EVENTBRITE_API_KEY`,
  `MEETUP_ACCESS_TOKEN`.
- The legacy ideas pipeline (`lib/pipeline/run.ts`) still calls Eventbrite
  directly; the events pipeline will route through the adapter in PR6.

## Community-event adapters (real, but conditional — honest degradation)
- Meetup (`lib/data/meetup.ts`, official free API, metered at $0) and Luma
  (`lib/data/luma.ts`, Firecrawl scrape of public pages) **no-op cleanly when
  unconfigured** and surface a notice. Meetup needs `MEETUP_ACCESS_TOKEN`; Luma
  needs `FIRECRAWL_API_KEY` + `LUMA_DISCOVERY_URL`.
- **Luma respects robots.txt:** the adapter fetches `<origin>/robots.txt`
  first and, if the target discovery path is Disallowed for `User-agent: *`,
  it **skips and returns a notice** — we never scrape a disallowed path.
  (Recorded here per amendment #3's instruction to log a robots-disallowed
  skip in MOCKED.md.)
- Both feed the same `events` corpus under the same field-level citation rule
  (each event's public URL is its `source_url`) and dedupe on the same key.

## Schema-ahead-of-UI / built-ahead-of-wiring (not mocked, just unbuilt/unwired)
- **Planning tables** (`event_plans` + its budget/cost columns, migrations
  `20260707000600` / `20260707000700`) and `events.certificates_offered` ship
  in the schema but have **no API, page, or UI yet** on this branch (Phase 5/6
  live on separate branches: `anish/outreach-p5`, `anish/plans-p6`). Nothing is
  surfaced, so there is nothing to label — no product claim until they ship.
- **Post-event debrief** (`event_debriefs` table, migration `20260707000700_*`):
  schema landed for v1.5, **no UI and no read/write path** in the app. No claim.
- **`qualitative_signals`** (migration `20260707000800_*`): captured NOW by
  conversational onboarding and stored on the profile
  (`app/api/nonprofit/profile/route.ts`), but **not yet consumed** — match
  explanations don't read it. Schema-now / used-later; no claim.
- **Roadmap items not built:** v1.5 Advocacy action drafts (4th outreach type)
  and v2 Donor Q&A Agent. No UI, no routes, no product claims until built.

## Configuration, not a mock
- Onboarding/nonprofit surface needs the Supabase migrations applied to function
  (the DB is empty without them). `/api/health` reports readiness
  (`supabase`, `ollama`, `anthropicKey`, `tavilyKey`, `firecrawlKey` — booleans).

## What runs live (not mocked)
Profile extraction, query planning, Tavily/Firecrawl search + scrape, ProPublica
990 enrichment, cloud match-explanation, and "draft it" all run live. Two
guarantees are now enforced in code and visible in-UI:
- **Citation or no signal:** the events pipeline DROPS any match whose evidence
  fails URL validation (no fabricated fallback); the dropped count is reported.
- **Cost receipt:** every provider call emits a CostEvent to `query_costs`, and
  the per-run receipt (total, % local, stage breakdown, budget-stop notices) is
  shown in the `/events` feed footer.

Rule: if it ships mocked, it's labeled in the UI and listed here.
