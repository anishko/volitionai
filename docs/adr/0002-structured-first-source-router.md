# Source router: structured event APIs first, crawler search for the long tail

Above the seed-corpus floor, the live source layer is composed by a source
router rather than the single Tavily→Firecrawl path shipped today. Structured
event APIs (Eventbrite, Meetup) run first because they return clean, already-
citable fields keyed off the profile's cause + geography; crawler search
(Tavily → Firecrawl) runs for the niche, long-tail issue-area events the APIs
miss; ProPublica 990 enrichment adds donor signals. Every source sits behind a
common Source adapter interface, returns a normalized Source candidate, and
emits a CostEvent.

We accept that Eventbrite's public event-search endpoint and Meetup's free API
are both largely retired/paywalled, so structured APIs are best-effort
enrichment, not a guarantee. The guarantee lives in the seed floor + relaxation
cascade (ADR-0004); the router's value is breadth and clean fields when the APIs
do respond.

Rejected: crawler-first (keeps a runtime dependency on scraping succeeding) and
curated-directory-only (loses the structured-field quality and the compounding
per-source metering).
