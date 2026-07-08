# Cause-broaden tier: universal events flag + a curated cause-adjacency map

The relaxation cascade's "broaden to adjacent causes" tier needs a concrete
definition of "adjacent." Strict cause overlap skips the sector-wide
fundraising/management conferences for a single-cause profile (they carry the
seven standard causes but not, say, civil_liberties), even though those events
teach fundraising to any org.

Two deterministic mechanisms: (1) a `universal` role flag on sector-wide
fundraising/management events so the cascade surfaces them for every profile
once matching relaxes past strict cause overlap; (2) a small hand-curated
cause-adjacency map (civil_liberties ~ human_services, faith_based; environment
~ health, youth; etc.) that defines the cause-broaden tier's expansion. Both are
explainable, so a "why attend" line can state the relaxation reason.

Rejected for v1: embedding similarity (less explainable, needs event vectors
maintained - kept as a later within-tier ranking refinement) and a flat
drop-cause tier (leans entirely on scoring, surfaces off-topic events). Schema
implication: events need a way to carry the universal role (flag or a
`cross_sector` tag); the adjacency map lives in code.
