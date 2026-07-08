# Mocked vs Real (judges will ask — keep honest and current)
- Cached demo fallback: **real prior pipeline output**, not hand-written.
  A successful live run is captured to `fixtures/demo/<persona>.json`
  (with `CAPTURE_FIXTURE=1`), timestamped, and served — labeled in-UI as
  "Cached run from <timestamp>" — only via `?cached=1` or `DEMO_FALLBACK=1`.
  Used only if the network fails on stage. Every card in a fixture went
  through the same citation validator as a live run (real, fetched URLs).
  Captured personas: `crestview-trading-club`, `camino-coffee`.

Schema-ahead-of-UI / built-ahead-of-wiring (not mocked, just unbuilt or unwired):
- Post-event debrief (`event_debriefs` table, migration `20260707000700_*`):
  promoted to v1.5 so the schema lands now, but there is **NO UI and no
  read/write path in the app yet** — nothing is surfaced, so there is nothing
  to label in-UI. Do not claim a debrief feature until v1.5 ships it.
- `qualitative_signals` (migration `20260707000800_*`): captured NOW by the
  conversational onboarding and stored on the profile, but **not yet consumed**
  — match explanations don't read it yet. Schema-now / used-later; no claim.
- Roadmap items are **not built**: v1.5 Advocacy action drafts (4th outreach
  type) and v2 Donor Q&A Agent. No UI, no routes, no product claims until built.

Adapter behavior (real, but conditional — honest degradation, not a mock):
- Community-event adapters no-op cleanly when unconfigured. Meetup needs
  `MEETUP_ACCESS_TOKEN`; Luma needs `FIRECRAWL_API_KEY` + `LUMA_DISCOVERY_URL`.
- **Luma is scraped via Firecrawl on PUBLIC pages and RESPECTS robots.txt**: the
  adapter fetches `lu.ma/robots.txt` first and, if the target discovery path is
  Disallowed for `User-agent: *`, it **skips and returns a notice** — we never
  scrape a disallowed path. (Recorded here per the amendment-#3 instruction to
  log a robots-disallowed skip in MOCKED.md.)

Onboarding/nonprofit surface needs Supabase migrations applied to function
(the DB is empty without them); that is configuration, not a mock.

Nothing else is mocked. Everything else (profile, search, synthesis,
citations, cost receipt, "draft it") runs live.
Rule: if it ships mocked, it's labeled in the UI and listed here.
