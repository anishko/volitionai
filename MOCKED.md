# Mocked vs Real (judges will ask — keep honest and current)
- Cached demo fallback: **real prior pipeline output**, not hand-written.
  A successful live run is captured to `fixtures/demo/<persona>.json`
  (with `CAPTURE_FIXTURE=1`), timestamped, and served — labeled in-UI as
  "Cached run from <timestamp>" — only via `?cached=1` or `DEMO_FALLBACK=1`.
  Used only if the network fails on stage. Every card in a fixture went
  through the same citation validator as a live run (real, fetched URLs).
  Captured personas: `crestview-trading-club`, `camino-coffee`.

Nothing else is mocked. Everything else (profile, search, synthesis,
citations, cost receipt, "draft it") runs live.
Rule: if it ships mocked, it's labeled in the UI and listed here.
