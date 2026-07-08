# Events pipeline implementation plan - ordered PRs

Fixes the empty-feed problem and builds the sourcing architecture decided in ADRs 0001-0007.
Ordered so the user-visible bug (new account sees no events) is dead after Wave 1, before any live-source work begins.
Conventions per CLAUDE.md: branch per person, PRs to main, `gh pr merge N --rebase`.

## Dependency graph

```
PR1 (schema + seed) ──▶ PR2 (cascade) ──▶ PR3 (seed floor + trigger)   [Wave 1: bug fixed]
PR1 ─────────────────▶ PR4 (source router) ──▶ PR5 (identity/merge) ──▶ PR6 (pipeline reorder)   [Wave 2]
PR3 + PR6 ──▶ PR7 (match-tier UI + trust polish)   [Wave 3]
```

PR2 and PR4 are parallelizable after PR1 lands.
PR3 does not wait for the live-source work; it ships the never-empty guarantee using the existing live pipeline as-is.

---

## Wave 1 - kill the empty feed

### PR1 - Schema and seed refresh

Branch: `feat/events-schema-universal`.

Migration `20260707001300_universal_match_tier_run_state.sql` (additive only; applied migrations are never edited):

- `events.is_universal boolean not null default false` - the universal-event role flag (ADR-0007).
- `event_matches.match_tier text not null default 'strict'` - which cascade tier produced the match (ADR-0004); check constraint on `('strict','geo_relaxed','cause_broadened','virtual_floor')`.
- New `match_runs` table: `id, profile_id fk, status ('floor_ready'|'live_running'|'done'|'failed'), notices jsonb, started_at, finished_at` - replaces the localStorage guard (ADR-0005); RLS: owner read, service-role write.

Seed changes (`supabase/seed.sql`, idempotent upsert rules already in place):

- Mark the 28 sector-wide fundraising/management rows `is_universal = true`.
- Roll past-dated 2026 events to their next announced edition, or null the dates if unannounced (never guess; citation rule).
- Add 5-10 wedge rows (civil_liberties) and at least one virtual event per cause area, each with a live source URL verified on the day of the commit.

Types: add `matchTier` to `EventMatch`, `isUniversal` to `Event`, `MatchRun` in `types/index.ts`.

Acceptance: migration applies cleanly on a reset local db; `supabase db reset` seeds without conflict; no seed row has a past end date unless its next edition is genuinely unannounced.

### PR2 - Relaxation cascade filter

Branch: `feat/relaxation-cascade`.

- New `lib/events/adjacency.ts`: the curated cause-adjacency map (civil_liberties ~ human_services, faith_based; environment ~ health, youth; etc.) with a one-line comment justifying each pairing.
- Rewrite `lib/events/filter.ts`: `filterCandidates(profile, events, floorN)` runs tiers in order - strict (cause ∩ geo ∩ upcoming) → drop geography → broaden via adjacency map + universal events → virtual anywhere - stopping at the first tier that reaches `floorN` (default 5); every kept event is tagged with its `matchTier`.
- `scoreEvent` applies a deterministic per-tier penalty (strict 0, geo -10, cause -15, virtual-floor -25) so relaxed matches never outrank strict ones.
- The filter must tolerate partial fields (crawler candidates arrive with a snippet-derived cause/geo guess in PR6).

Pure functions; unit tests are the acceptance gate:

- civil_liberties-only profile over the seed corpus returns ≥ floorN matches, with the 5 wedge rows tiered `strict` and universal rows `cause_broadened`.
- A profile matching nothing strict still gets the virtual floor.
- Empty corpus returns empty (the honest case; never fabricate).

### PR3 - Seed floor at onboarding, DB run state, progress screen

Branch: `feat/onboarding-seed-floor`.

This PR alone makes the reported bug impossible; it deliberately reuses the existing live pipeline unchanged.

- New `lib/events/floor.ts`: `runSeedFloor(admin, profile)` - load corpus, run the PR2 cascade, score, `upsertMatches` with `match_tier`, no external calls, no LLM; explanation text is a deterministic template ("Matched on cause + geography" per tier) until the live explainer overwrites it.
- Profile-creation flow (`app/api/nonprofit/profile/route.ts` POST): after profile insert, synchronously run the seed floor and create a `match_runs` row (`floor_ready`), then kick the live run.
- Live run: `POST /api/events/match` gains a wall-clock budget (~60s soft cap inside the run; stage-level timeouts already exist) and updates `match_runs` status/notices; on failure it marks `failed` with the reason - never silent.
- New progress screen (post-onboarding route or state): shows pipeline stages, polls `match_runs`; past 25s shows "Continue to your events" (feed is already populated by the floor); auto-advances on `done`.
- `components/events-feed.tsx`: delete the localStorage guard; feed re-fetches when a poll reports `done`; a visible "Find more events" button re-runs matching whenever the last run is `failed` or stale (> 7 days).

Acceptance (E2E, per the reproduce-the-bug-first rule):

- Fresh account → onboarding → `/events` shows ≥ 5 event cards with zero external API keys configured (Tavily/Firecrawl/Eventbrite unset).
- Kill Ollama and the network mid-run: feed still shows the floor; run state reads `failed`; "Find more events" retries.
- Cost receipt for the floor shows $0.

---

## Wave 2 - live source layer

### PR4 - Source router and adapters

Branch: `feat/source-router`.

- New `lib/events/sources/types.ts`: `SourceAdapter` interface - `id`, `kind: 'structured' | 'crawler'`, `fetch(profile, queries, meter) → SourceCandidate[]`; `SourceCandidate` is either a pre-filled event (structured, fields cited to the canonical URL) or a URL + snippet to scrape (crawler).
- `lib/events/sources/tavily.ts`: wrap the existing `searchEventCandidates` as the crawler adapter (budget cap and host exclusions move with it).
- `lib/events/sources/eventbrite.ts`: move `lib/data/eventbrite.ts` usage out of the legacy ideas pipeline path and behind the adapter interface; treat a 404 from the retired search endpoint as a clean "source unavailable" notice, not an error.
- `lib/events/sources/meetup.ts`: best-effort Meetup adapter; if the free API rejects, log the notice and return empty.
- `lib/events/sources/router.ts`: runs structured adapters first, then crawler, each under its own budget; aggregates candidates + notices; every adapter call emits a CostEvent even at $0.
- MOCKED.md: entries for Eventbrite and Meetup being best-effort/retired, per the honest-mocks rule; the run notice surfaces in the receipt footer when a source returned nothing.

Acceptance: unit tests with fetch stubbed - router ordering, per-adapter budget stops, dead-endpoint degradation produces a notice and an empty contribution, never a thrown run.

### PR5 - Event identity and merge

Branch: `feat/event-identity`.

- Migration `20260707001400_event_identity.sql`: `events.identity_key text` + unique index; backfill from existing rows (organizer domain = normalized `website` host; fuzzy fallback `slug(name)+year+city`); keep the old unique constraint until backfill verifies, then drop in the same migration.
- `lib/events/identity.ts`: `identityKeyFor(candidate)` - organizer domain when resolvable (structured adapters expose `organizer_url`), else the fuzzy key; unit-test the collision cases (same conference via seed + Eventbrite + Tavily → one key; two distinct similarly-named events → two keys).
- `lib/events/store.ts`: `upsertDiscoveredEvents` merges on `identity_key`; richest field wins (non-null over null, longer arrays over shorter, newer `scraped_at` over older); all contributing source URLs append to the row's evidence so a card can cite every source.

Acceptance: integration test - the same event injected from three sources produces one row, one card, three citations.

### PR6 - Pipeline reorder: filter first, uniform scrape of finalists

Branch: `feat/filter-first-scrape`.

Rewrite `lib/events/run.ts` to the ADR-0003 order:

1. PLAN (unchanged, local).
2. SOURCE via the PR4 router (replaces the inline Tavily call).
3. CHEAP FILTER + SCORE (PR2 cascade) over corpus + structured candidates + crawler candidates; crawler URLs get a provisional cause/geo guess from the Tavily snippet (keyword heuristic first; local-model classify only if the heuristic proves too weak in test fixtures).
4. Pick top-K finalists (keep K=12).
5. UNIFORM scrape: Firecrawl + local extract only for finalists that are unscraped or stale (`last_scraped_at` > 30 days, or > 7 days with a deadline inside 45 days); 15-page hard cap unchanged; structured-API finalists with fresh fields skip the scrape and keep canonical-URL citations.
6. Re-score with verified fields; match tier may change; re-tier honestly.
7. ENRICH (990) → EXPLAIN (cloud, finalists only) → VALIDATE → MERGE + STORE via PR5.

Acceptance: fixture-driven run test - Firecrawl budget is spent only on finalists; a structured candidate reaches the feed without a scrape; re-score demotes a finalist whose scraped dates turn out past; receipt shows per-stage costs in the new order.

---

## Wave 3 - honest UI

### PR7 - Match-tier labels and trust polish

Branch: `feat/match-tier-ui`.

- EventCard shows a quiet tier label for non-strict matches ("nearby causes", "virtual option", "beyond your region") with a tooltip stating the relaxation reason - deterministic from `match_tier`, per ADR-0007's explainability requirement.
- Feed header states when results were broadened: "Not enough exact matches - we broadened to related causes" (honest, no padding).
- Progress screen copy pass; receipt footer shows source-unavailable notices from PR4.
- Multi-source citations on the event detail page (`/events/[id]`) from PR5's evidence array.

Acceptance: pixel pass on the feed and detail page; a `cause_broadened` match is visually distinguishable from a strict one; no unsourced field renders.

---

## Team split (4 people, after PR1 lands)

| Person | Wave 1 | Wave 2+ |
|---|---|---|
| A | PR1 → PR3 (trigger + progress screen) | PR6 (reorder) |
| B | PR2 (cascade + tests) | PR5 (identity) |
| C | PR4 (source router, parallel with Wave 1) | PR4 hardening |
| D | Seed refresh verification in PR1 (URL-by-URL) | PR7 (UI) |

## Verification discipline

Every PR that touches the run must keep the E2E from PR3 green: fresh account, no external keys, populated feed.
That E2E is the regression guard for the original bug and should run in CI if time allows, else as a documented manual checklist in the PR template.
