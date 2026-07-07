# Cost model & per-query auditing

## Why this exists
"AI-powered" tools hide their unit economics. Volition meters every
provider call and prints the receipt on every answer. This is (a) a
trust feature for users, (b) our margin dashboard, (c) a Technical-
rubric answer ("how fast / what are the bottlenecks / what does it
cost"), and (d) on-mission: prices are information (Hayek); we
refuse to hide ours.

## Price table (lib/ai/prices.ts is source of truth; verify before pitch)
- claude-sonnet-4-6: $3.00/M input, $15.00/M output
- claude-haiku-4-5:  $1.00/M input, $5.00/M output
- ollama (any local): $0.00 marginal (electricity ignored; say so honestly)
- tavily basic search: $0.008/credit PAYG, $0 within free tier
- firecrawl extract: ~$0.0008-0.001/page on paid; $0 in trial credits
- youtube / reddit: $0

## Worked example — one full research run (~8 searches, 4 scrapes)
| Stage | Provider | Est. tokens/calls | Cost |
|---|---|---|---|
| Plan + extract + rank | Ollama | ~15K tokens | $0.000 |
| Search | Tavily x8 | 8 credits | $0.064 (or $0.000 free tier) |
| Deep scrape | Firecrawl x4 | 4 pages | ~$0.004 |
| Synthesis | Haiku 4.5 | ~10K in / 2.5K out | ~$0.023 |
| Drafts | Ollama | ~4K tokens | $0.000 |
| TOTAL (Haiku path) | | | ~$0.09 PAYG, ~$0.03 with free tiers |
| TOTAL (Sonnet synthesis) | | ~10K/2.5K @ $3/$15 | ~$0.13 PAYG |

Steady state (plan pricing + local routing): $0.02-0.05 per full run.

## The comparison (how to say it without overclaiming)
We are not "cheaper than Claude" — we USE Claude where it earns its
keep. The claim is: a general chatbot subscription ($20/mo) sends
every token to a frontier model and gives you uncited, generic,
memoryless output. Volition routes ~70% of tokens to local models at
$0, pays cloud rates only for the synthesis step, and produces
cited, profile-specific, execution-ready output at an audited
$0.03-0.13 per run. At $19/mo a heavy user doing 40 runs costs us
under $5 — 75%+ gross margin — and the user can SEE that math.
Versus enterprise intelligence suites ($800-3,000/mo), we're not
even on the same axis.

## Implementation
- types/cost.ts → CostEvent emitted by every provider wrapper
- Supabase table query_costs(run_id, stage, provider, model,
  input_tokens, output_tokens, unit_count, usd, created_at)
- /api/ideas returns { cards, receipt: { totalUsd, byStage[] } }
- Dashboard renders the receipt under the cards; admin page
  /costs charts avg cost/run, p95, cost by stage over time

## Comparing & testing (eval harness)
scripts/eval.ts runs fixture inputs through both routing modes:
  npm run eval -- --mode local  (qwen3:8b for every stage)
  npm run eval -- --mode cloud  (haiku for every stage)
Outputs a table: extraction field-accuracy vs a hand-labeled answer
key, latency, and cost per run. Purpose: prove with numbers that
local handles extraction/planning at parity, reserving cloud spend
for synthesis. That table goes IN the pitch deck — nobody else will
have benchmarked their own pipeline.
