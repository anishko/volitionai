# Event identity: resolve to organizer domain, else fuzzy name+year+city

The shipped dedupe key is `unique(website, name, start_date)`. Because a
platform listing's URL is the platform's domain (eventbrite.com), not the
organizer's, the same real conference arriving from the seed row, an Eventbrite
listing, and a Tavily hit would produce three rows and three duplicate cards,
fragmenting the compounding-corpus moat.

Event identity resolves platform listings to the event's real organizer domain
(Eventbrite/Meetup expose `organizer_url`) and keys on that; when no organizer
domain is resolvable, it falls back to a fuzzy key of normalized name-slug +
year + city. Matching candidates merge into one corpus row, the richest field
value wins, and every contributing source URL is preserved as evidence so the
card can cite all of them.

Rejected: fuzzy-key-only (false merges of similarly-named distinct events;
false splits on divergent naming) and domain-key-only (accepts duplicate cards
and a fragmented moat). Accepted cost: the merge logic must pick "richest field"
and carry a multi-source evidence array.
