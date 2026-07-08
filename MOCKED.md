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
  directly. The events pipeline now routes through the adapters: a match run
  (`lib/events/run.ts`) fetches candidates via `fetchSourceCandidates`
  (`lib/events/sources/router.ts`) across all structured + crawler adapters,
  so this is wired, not pending.

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

## Shipped since the last refresh (was schema-ahead-of-UI, now live)
These were listed here as schema-only; they now have live API + UI on `main`
and are **no longer mocked or unwired**. Kept as an explicit correction so the
list stays honest in both directions.
- **Post-event debrief** (`event_debriefs` table + `20260708060422_debrief_actuals`)
  is **live** (PR #24): `app/api/debriefs/route.ts` + `[id]`, the debrief form
  and planned-vs-actual view at `app/debriefs/[matchId]/page.tsx`, and an entry
  link from event detail. Real read/write path — the prior "no UI, no claim"
  note is stale and removed.
- **Planning tables** (`event_plans`, migrations `20260707000600` /
  `20260707000700`, `events.certificates_offered`) are **live**: `app/api/plans`
  (`route.ts`, `[id]`), the plan pages `app/plan/page.tsx` /
  `app/plan/annual/page.tsx`, and `lib/plans/*`. **Annual export** ships at
  `app/api/plans/annual/export/route.ts`. No longer on a separate branch.
- **Outreach** is **live**: `app/api/outreach/route.ts`, the drafter at
  `app/outreach/[matchId]/page.tsx` + `components/outreach-drafter.tsx`, backed
  by `lib/outreach/draft.ts` / `store.ts`. The "Phase 5 on `anish/outreach-p5`"
  note is stale and removed.

## Still schema-ahead-of-UI / unbuilt (genuinely no product claim)
- **`qualitative_signals`** (migration `20260707000800_*`): captured NOW by
  conversational onboarding (`lib/nonprofit/onboarding-schema.ts`) and stored on
  the profile, but **still not consumed** — no matcher/explain code reads it
  (verified: only the onboarding schema references it). Schema-now / used-later;
  no claim.
- **Roadmap items not built:** v1.5 Advocacy action drafts (4th outreach type)
  and v2 Donor Q&A Agent. No UI, no routes, no product claims until built.

## Configuration, not a mock
- Onboarding/nonprofit surface needs the Supabase migrations applied to function
  (the DB is empty without them). `/api/health` reports readiness
  (`supabase`, `ollama`, `anthropicKey`, `tavilyKey`, `firecrawlKey` — booleans).

## Current live-lane gaps (dark or degraded right now — say so out loud)
Honesty discipline works both ways: these are real capabilities the
architecture supports but that are **not exercised in the current deployment**.
Each degrades cleanly (notice + metered $0, run continues), but do not claim
them as working in a demo unless the env is configured.
- **Firecrawl unconfigured → deep-scrape dark.** Without `FIRECRAWL_API_KEY`,
  the uniform scrape stage (`lib/events/scrape.ts`, called from
  `lib/events/run.ts`) contributes nothing and the run surfaces a skip notice;
  Luma discovery (which scrapes via Firecrawl) is also dark. The feed still
  fills from the seed corpus + structured adapters + the relaxation cascade. A
  **Tavily-extract fallback** for the deep-scrape path is in progress on
  `anish/tavily-extract` (parallel work — do not edit `lib/events/scrape.ts`,
  `lib/data/`, or `lib/ai/cost.ts` here).
- **Meetup token absent → structured Meetup adapter dark.** Without
  `MEETUP_ACCESS_TOKEN` the Meetup adapter no-ops with a notice (metered $0);
  no Meetup candidates enter the corpus until it is set.
- **Ollama absent in prod → 0% local routing.** The "roughly half of tokens run
  locally at $0" pillar depends on a reachable Ollama (`/api/health` reports
  `ollama: false` in prod today). When it is unreachable, routing falls back to
  cloud **by design** (no hard failure) — but the cost receipt's
  `localTokenShare` reads **0%** and the run is fully cloud-metered. The split
  is real only where Ollama is actually running (local dev / a provisioned box).

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
