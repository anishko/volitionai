# Event scope stays nonprofit-only; empty feed is a wiring problem, not a scope problem

The `/events` feed shipped empty for the demo personas. The candidate fix was
to broaden the corpus to consumer/local/social event platforms (Eventbrite,
Partiful, Meetup) so org types like a student trading club or a coffee shop
would get results.

We decided **not** to broaden. The product stays a nonprofit-conference finder.
The empty feed is caused by unreliable sourcing wiring, not by too-narrow scope:
the Eventbrite adapter is built but wired only into the legacy ideas pipeline
(`lib/pipeline/run.ts`), Meetup/Luma adapters were never built, the rules filter
drops every candidate when cause overlap is zero, and a match runs exactly once
(localStorage guard) with no retry on a silent failure.

Consequences: the "Bull & Bear Society" and "Camino Coffee" personas are dropped
from this product's scope. Work focuses on (1) wiring reliable nonprofit-event
sources into `lib/events/run.ts`, (2) a never-empty filter fallback, and
(3) retry/freshness on the run trigger. Broadening to general local events, if
ever revisited, would be a separate product sharing this pipeline - not a change
to this corpus.
