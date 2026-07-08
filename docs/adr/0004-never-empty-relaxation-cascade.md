# Never-empty contract: relaxation cascade over the seed floor

The shipped filter is all-or-nothing: strict cause ∩ geography ∩ upcoming, and
if that zeroes out the corpus the feed is empty with no recourse. Thin wedge
coverage (a civil_liberties-only profile overlaps only ~5 seed rows), stale
dates, and geography drops can each empty a legitimate nonprofit's feed.

We make a run over a non-empty corpus never return empty. Strict matching runs
first; if it yields fewer than a floor count N, filters relax in fixed, labeled
tiers: drop geography → broaden to adjacent causes → include virtual anywhere.
Each tier is scored lower and carries a match-tier label, and the UI states
honestly that results were broadened. Live discovery enriches on top; it is
never the sole path to a non-empty feed.

This is the real reliability guarantee behind the best-effort structured APIs
(ADR-0002). Rejected: making live discovery primary (runtime API dependency,
demo risk) and widen-seed-only (still brittle to unusual profiles).
