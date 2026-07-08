# Pipeline reorder: cheap filter first, then one uniform scrape of finalists

The shipped pipeline scrapes live candidates before filtering and never
re-scrapes seed rows, so structured-API data and scraped data would be trusted
on different paths. We reorder the pipeline so every event's fields are produced
by one identical Firecrawl + local-extract path, and so the Firecrawl budget is
spent only on relevant events.

New order: PLAN → SOURCE (router) → CHEAP FILTER + SCORE (relaxation cascade,
run on whatever fields exist - seed/API events have them; crawler URLs get a
provisional cause/geo guess from Tavily's snippet) → pick top-K finalists →
UNIFORM Firecrawl + extract on finalists that are stale/unscraped, capped at 15
pages, staleness-gated → re-score with verified fields → ENRICH (990) → EXPLAIN
(cloud) → VALIDATE → STORE.

Consequence: the rules filter must tolerate partial fields for crawler
candidates (snippet-derived guess), and re-score after scraping because verified
fields can change score and match tier. Rejected: scrape-until-cap-then-filter
(wastes budget on rejects, doesn't guarantee finalists are scraped) and
scrape-all-stale (no relevance gate on the budget).
