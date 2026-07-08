# "Isn't this just ChatGPT?" — the answer matrix

| | ChatGPT/Claude chat | Perplexity | Brandwatch/Sprout | Jasper/Predis | VOLITION |
|---|---|---|---|---|---|
| Knows YOUR org persistently | manual re-prompting | no | enterprise setup | shallow brand kit | structured profile + voice, extracted once |
| Live researched evidence | sometimes, loosely cited | yes, generic | yes | no | yes, scoped to your profile |
| Citation enforced mechanically | no | mostly | n/a | no | validator rejects uncited cards |
| Output form | prose | prose | dashboards | captions | execution-ready IdeaCards |
| Comparable-org benchmarking | no | no | $$$$ | no | core lane |
| Cost per answer visible | never | never | never | never | on every card |
| Local/private processing | no | no | no | no | roughly half of tokens on-device at $0 (exact split on every receipt) |
| Built on open infrastructure | no | no | no | no | open-weight local models, model-agnostic router, no vendor lock-in |
| Price | $20/mo generic | $20/mo | $800-3,000/mo | $39+/mo | audited $0.03-0.13 per run — you see the receipt |

Verbal answer (rehearse): "Three things a chatbot can't do: it
doesn't KNOW you — we keep a structured profile and voice; it isn't
ACCOUNTABLE — our validator mechanically rejects any idea that
can't cite a fetched source; and it isn't HONEST about cost — we
print the receipt on every answer. And it runs on open infrastructure:
open-weight local models you can own, a model-agnostic router with no
vendor lock-in — your data stays local, your model choice stays open."

Mission tie: open INFRASTRUCTURE + local models = no gatekeeper, no
permission, no institutional dependency. The USER's independence is
architectural — their data local, their model choice open, their
costs visible — the free-market answer to AI centralization.

## Why open infrastructure wins (the stack bet)
Linux and PostgreSQL are the precedent: open INFRASTRUCTURE that won
on cost and control, and that proprietary products are routinely built
on top of. That is our bet too — not that Volition is a distribution
strategy, but that open-weight models and a model-agnostic router are
the cheapest, most controllable foundation to build a proprietary
product on. The openness is in the layer beneath us; the value we add
on top — the pipeline, the profiles, the benchmarking dataset — is ours.

## Hostile questions
Q: "Why not open-source it, given the freedom pitch?"
A: "The freedom claim is about the USER's independence — their data
local, their model choice open, their costs visible. That's
architecture, not licensing. The proprietary layer funds the
benchmarking dataset that makes every user's results better."

## Decentralization posture

**Local-first compute = user data sovereignty (now).** Extraction, planning,
ranking, and drafting run on the user's own hardware via Ollama. Uploaded
documents and donor numbers are parsed locally and discarded; only extracted
facts persist. The user's sensitive data does not leave their machine as a
condition of using the product — that is data sovereignty in the architecture,
not a policy promise.

**Model-agnostic router = no gatekeeper (now).** The router picks the cheapest
capable model per stage and treats cloud models as interchangeable suppliers.
Inference is *bought on an open competitive market* rather than rented from a
single vendor who could gatekeep access, price, or terms. Switching a supplier
is a config change, not a rewrite.

**Pluggable inference adapters = decentralized marketplaces are on the table
(future, evaluated).** Because inference is behind an adapter, decentralized
inference marketplaces — e.g. Morpheus-style peer-to-peer inference — are a
genuine future provider option, attractive for privacy and for adding provider
competition. We are deferring them for now on reliability grounds (no failover
guarantees) and token friction (paying for inference in a marketplace token
adds UX and treasury overhead). Evaluated, not adopted.

**Corpus cryptographic verifiability (planned when multi-contributor).** Today
the events corpus is written by our own server-side pipeline, so field-level
`source_url` + `verified_at` stamps are sufficient provenance. When the corpus
becomes multi-contributor, we plan signed records / Merkle checksums so any
consumer can verify a record's integrity and origin independently of us.

**No token, ever.** We will not issue a token. A token solves a problem we do
not have (bootstrapping a two-sided network with speculative incentives) and
would import volatility, regulatory surface, and misaligned incentives into a
product whose entire trust proposition is factual, sourced, and metered.
