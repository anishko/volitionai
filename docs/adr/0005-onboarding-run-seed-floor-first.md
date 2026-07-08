# Match run fires at onboarding; seed floor first, live enrich under a wall-clock cap

The shipped trigger runs the match once on the first `/events` load, guarded by
localStorage, blocking behind a spinner with no retry - so a silent failure or
empty result is permanent, which is the direct cause of the empty-feed
complaint.

The run now fires on onboarding completion. It computes and stores the
seed-floor matches synchronously first (cheap filter+score over the seed corpus,
no external calls) so `/events` is guaranteed populated. It then attempts live
enrichment under a hard wall-clock budget. A progress screen shows the stages
and, past ~25s, offers "continue to your events" that drops the user into the
already-populated feed while live enrichment finishes in the background and
merges in. Run state and retry live in the database, not localStorage.

This makes an empty feed structurally impossible whenever the corpus is
non-empty, and keeps any single request well under serverless timeout limits.
Rejected: a single 60-180s blocking request (hang traps the user, hits host
request caps) and a fully async polled job (more state plumbing than the
seed-floor-first approach needs for the demo).
