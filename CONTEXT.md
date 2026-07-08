# Volition - Nonprofit Events

The domain language for finding nonprofit conferences and convenings where an
org's next donors already are, matching them to a persistent org profile, and
showing the cited evidence and metered cost behind every match.

## Language

**Event corpus**:
The shared `events` table - every match run reads from it and writes new finds
back into it, so it compounds across users. The product's data moat.
_Avoid_: database, event list, catalog.

**Seed event**:
A hand-curated conference in the corpus (`is_seed = true`), sourced but static,
refreshed annually. The reliability floor for a match run.
_Avoid_: default event, static event.

**Live-discovered event**:
An event found during a match run by live search/scrape and merged into the
corpus. Distinct from a seed event only by provenance, never by citation
standard.
_Avoid_: dynamic event, scraped event (it may come from a structured API, not a scrape).

**Match run**:
One end-to-end execution of the pipeline for a profile: plan → source → filter
→ explain → score → store. Emits one cost receipt.
_Avoid_: search, query, generation.

**Cause overlap**:
The intersection between a profile's `cause_areas` and an event's
`cause_area_tags`. The primary hard filter and the largest scoring component.
_Avoid_: match, relevance, category fit.

**Donor signal**:
A 990-confirmed foundation presence tied to an event (sponsor/speaker
cross-reference), each carrying a filing URL and an event source URL.
_Avoid_: lead, prospect, sponsor (a sponsor is a raw event field; a donor
signal is the enriched, cited inference).

**Relaxation cascade**:
The never-empty contract in the filter: if strict matching (cause ∩ geography ∩
upcoming) yields fewer than a floor count, filters relax in fixed tiers (drop
geography → broaden to adjacent causes → include virtual anywhere), each tier
scored lower and labeled, so a run over a non-empty corpus is never empty.
_Avoid_: fallback, loosening, fuzzy match.

**Match tier**:
Which relaxation step produced a match (strict, geo-relaxed, cause-broadened,
virtual-floor). Drives both the score penalty and the honest UI label.
_Avoid_: relevance bucket, quality band.

**Universal event**:
A sector-wide fundraising/nonprofit-management conference relevant to any org
regardless of cause (it teaches fundraising, not a cause). Flagged on the event
so the cascade surfaces it once matching relaxes past strict cause overlap.
_Avoid_: general event, cross-sector (that is the raw tag; universal is the role).

**Cause adjacency**:
The curated map of which cause areas count as related in the cause-broaden tier
(e.g. civil_liberties ~ human_services, faith_based). Deterministic so a match
explanation can state why an adjacent-cause event was surfaced.
_Avoid_: similarity, relatedness.

**Source router**:
The stage that decides which sources run for a given profile and in what
priority - structured event APIs first (Eventbrite, Meetup), crawler search for
the long tail (Tavily → Firecrawl), then enrichment (ProPublica 990).
Introduced to fix the empty-feed problem.
_Avoid_: fetcher, connector layer.

**Source adapter**:
One integration behind a common interface that emits a `CostEvent` and returns
normalized candidates. A structured adapter returns ready events; a crawler
adapter returns URLs to scrape.
_Avoid_: driver, plugin, provider.

**Source candidate**:
The normalized unit a source adapter yields - either a pre-filled event (from a
structured API, already citable to its canonical URL) or a URL to be scraped
(from crawler search). The filter and scorer treat both identically once
normalized.
_Avoid_: hit, result, lead.

**Event identity**:
The key that collapses candidates for the same real conference into one corpus
row: the organizer's canonical domain when resolvable (platform listings expose
`organizer_url`), else a fuzzy key of name-slug + year + city. All contributing
source URLs are preserved as evidence on the merged row.
_Avoid_: dedupe key, primary key.
