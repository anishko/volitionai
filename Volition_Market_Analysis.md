# Volition — Competitive & Market Analysis

*Prepared for Team Volition's FEE Hackathon 2026 pitch. Volition is an open-source, on-demand market-intelligence tool for the smallest organizations — school clubs, small businesses, sports teams, nonprofits, community groups. It extracts an org profile + voice with a local LLM (Ollama), researches the live web through metered APIs (Tavily, Firecrawl, YouTube, Reddit), and returns cited "IdeaCards" with a per-query Cost Receipt. Positioning: "Every Fortune 500 has an insights team. Volition gives that team to everyone else — and shows you the receipt."*

**Two product-context flags before we begin (verify before the pitch):**
- **License:** This brief describes Volition as MIT-licensed, but the repo's own `README.md`, `NOTICE`, and `DIFFERENTIATION.md` all state **Apache-2.0**. Both are permissive OSI licenses, but pick one story and make it consistent across deck and repo. *(Source: local repo docs.)*
- **Local model:** The brief cites Llama 3.1 8B; the repo's `CLAUDE.md`/`ARCHITECTURE.md` set the default to **qwen3:8b** (with `llama3.2:3b` as the low-RAM fallback). The economics below hold for any local model at $0 marginal cost, but state the actual default model in the demo. *(Source: local repo docs.)*

---

## 1. Market Landscape & Sizing

### The category stack Volition sits in
Volition competes across four overlapping software markets. All are growing double-digits, which matters for a mission pitch: the tooling to turn data into decisions is expanding fast, but — as Section 1c shows — it is being sold overwhelmingly to organizations that are not micro-orgs.

| Market | Size / forecast | CAGR | Source |
|---|---|---|---|
| Social media analytics / social listening | USD 43.25B by 2030 (2024 base) | 27.2% (2025–30) | [Grand View Research](https://www.grandviewresearch.com/press-release/global-social-media-analytics-market) |
| Marketing analytics software | USD 3.78B (2022) → USD 12.51B by 2030 | 16.7% (2023–30) | [Grand View Research](https://www.grandviewresearch.com/industry-analysis/marketing-analytics-software-market) |
| Competitive-intelligence tools | USD 0.71B (2025) → USD 4.03B by 2034 | 21.17% (2026–34) | [Fortune Business Insights](https://www.fortunebusinessinsights.com/competitive-intelligence-tools-market-104522) |
| AI in marketing | USD 20.44B (2024) → USD 82.23B by 2030 | 25.0% (2025–30) | [Grand View Research](https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-marketing-market-report) |
| SMB software (context) | USD 72.35B (2025) → USD 107.86B by 2031 | 6.88% | [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/smb-software-market) |
| Business intelligence software (context) | USD 40.13B (2025) → USD 81.45B by 2033 | 9.3% (2026–33) | [Grand View Research](https://www.grandviewresearch.com/press-release/global-business-intelligence-software-market) |

**Note on the competitive-intelligence figure:** estimates vary widely by scope — Mordor Intelligence puts the same category at USD 0.59B (2025) → USD 1.46B by 2030 ([Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/competitive-intelligence-tools-market)). Treat "market-intelligence tools" as a low-single-billions category today; the larger dollars sit in social analytics and AI-marketing.

### TAM / SAM framing for Volition
There is no clean published line-item for "market-intelligence tools sold to under-20-person orgs," so build TAM bottom-up from org counts (Section 1b) rather than quoting a single analyst number — and **flag that no isolated SMB marketing-technology spend figure could be verified** ([research note](https://www.grandviewresearch.com/horizon/statistics/software-as-a-service-saas-market/enterprise-size/small-medium-enterprises/global)).
- **TAM (adjacent):** the AI-in-marketing (USD 82B by 2030) + social-analytics (USD 43B by 2030) categories Volition draws capability from ([GVR](https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-marketing-market-report), [GVR](https://www.grandviewresearch.com/press-release/global-social-media-analytics-market)).
- **SAM (Volition's wedge):** US micro-orgs that today buy little or nothing here — the count is enormous (below), the current spend is near-zero, and that gap *is* the opportunity, not a weakness.

### 1b. How many micro-organizations exist (US)
- **36,207,130 US small businesses** — 99.9% of all US businesses; they employ 62.3M people (45.9% of the private-sector workforce) ([SBA Office of Advocacy, 2026](https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/)).
- Of those, the overwhelming majority are the *smallest*: **30,427,808 nonemployer establishments (2023)** — businesses with no paid employees — versus ~5.58M firms with under 500 employees and at least one employee ([US Census, Small Business Week 2026](https://www.census.gov/library/stories/2026/05/small-business-week.html)). *(Exact <20-employee and <5-employee counts could not be confirmed on current pages — flagged.)*
- **1,935,344 registered US nonprofits**, "most of them small" ([Candid](https://candid.org/impact-insights/us-social-sector/)). *(Share under $100k/$500k revenue not verified — flagged.)*
- **3,542 degree-granting postsecondary institutions** (2,267 four-year, 1,275 two-year) ([NCES](https://nces.ed.gov/programs/coe/indicator/csa/postsecondary-institutions)); 5,819 Title IV institutions ([IES](https://ies.ed.gov/learn/press-release/total-number-higher-education-institutions-decreases-2-percent)). A national count of college clubs is not published, but the average student org has ~18 active members ([Campus Labs](https://www.campusintelligence.com/topics/student-engagement/hq/what-category-of-organizations-generates-the-highest-membership/)) — so even a conservative 100–300 clubs per large campus implies **hundreds of thousands of US college clubs**. *(National club count: flagged as unverified — present as an illustrative bottom-up estimate, not a cited figure.)*
- **98,577 public K-12 schools + 30,492 private schools** ([NCES Fast Facts](https://nces.ed.gov/fastfacts/display.asp?id=84)), and **8,266,244 high-school sports participants in 2024–25** (a record) ([NFHS](https://nfhs.org/stories/participation-in-high-school-sports-hits-record-high-with-sizable-increase-in-2024-25)).

**The headline:** tens of millions of micro-businesses plus ~2M nonprofits plus hundreds of thousands of student/sports/community groups — the largest, most underserved buyer set in the marketing-tech market.

### 1c. What micro-orgs spend — and refuse to spend — on marketing intelligence
This is the crux of the pitch. Micro-orgs do have marketing budgets, but they are tiny, DIY, and almost never spent on *intelligence*:
- SBA guidance: small businesses should spend **7–8% of gross revenue** on marketing (advertising specifically ~1.08%) ([CO Consulting](https://christopholivierconsulting.com/marketing-budget-benchmarks/)). In dollars, a 2023 survey pegs the typical small-business spend at **~$534/month (~$6,400/year)** ([Revenue Memo](https://www.revenuememo.com/p/small-business-marketing-budget-statistics)).
- But most spend far less: **52% of small businesses have monthly marketing budgets under $1,000**, and **50% have no employees dedicated to marketing** ([LocaliQ](https://localiq.com/blog/small-business-marketing-trends-report-2026/)). **66.3% spend under $1,000/year total** ([Revenue Memo](https://www.revenuememo.com/p/small-business-marketing-budget-statistics)).
- The smallest are the most starved: businesses with ≤10 employees are **55% more likely to have a budget under $500/month, 45% more likely to have no full-time marketer, and 72% spend only 1–10 hours/week on marketing** ([LocaliQ](https://localiq.com/blog/small-business-marketing-trends-report-2026/)).
- And they don't use data at all: **only ~10% of small businesses use analytics, 54% are "rarely data-driven"** ([Techaisle via Candid Creative](https://candidcreative.ca/kb/techaisle-smb-data-adoption-survey)); **only 5% use a BI dashboard while 65% run on Excel/Google Sheets** ([Software Advice via Candid Creative](https://candidcreative.ca/kb/software-advice-5pct-smb-bi-dashboard-243-sample)).

**Interpretation for the pitch:** the market intelligence category is not too small for micro-orgs — it is *priced and designed past them*. They have hours-a-week and hundreds-of-dollars-a-month, not $800–$3,000/month seats and analyst headcount. Volition's job is to convert "refuse to spend on intelligence" into "run 30 queries for a few dollars." *(Direct willingness-to-pay data for CI tools among micro-orgs: not found — flagged.)*

---

## 2. Competitor Teardown (direct + adjacent)

### Pricing comparison table (official pages as of July 2026)

| Tool | Entry price | Higher tiers | Free tier? | Target customer | Core capability | Gap vs. Volition |
|---|---|---|---|---|---|---|
| **Brandwatch** | Quote-only ([pricing](https://www.brandwatch.com/pricing/)) | Est. ~$800–$5,000+/mo; enterprise $36k–$150k+/yr ([CheckThat.ai](https://checkthat.ai/brands/brandwatch/pricing)) | No (demo only) | Enterprise brands, agencies, research teams | Consumer/social intelligence, listening, sentiment | Priced for enterprises; no local/private processing; no per-query cost; no persistent micro-org profile |
| **Sprout Social** | Standard $199/seat/mo (annual) ([pricing](https://sproutsocial.com/pricing/)) | Professional $299, Advanced $399, Enterprise custom; Listening add-on price n.a. | 30-day trial | SMB→enterprise social teams | All-in-one social mgmt + listening | Per-seat model unaffordable for clubs; no cited-idea output; no cost receipt |
| **Meltwater** | Quote-only ([pricing](https://www.meltwater.com/en/pricing)) | Est. median ~$25k/yr, $6k–$150k+/yr ([Vendr](https://www.vendr.com/marketplace/meltwater)) | No (annual contract) | PR/comms, mid-market→enterprise | Media intelligence, PR monitoring, listening | Enterprise-only; opaque pricing; nothing micro-org-scaled |
| **Semrush** | SEO $117.33/mo (annual) ([pricing](https://www.semrush.com/prices/)) | Starter $165, Pro+ $248, Advanced $455; Free plan | Free plan | SMB→mid-market marketers, SEO, agencies | SEO, keyword/competitor research, AI-search visibility | SEO-centric, not idea-generation; no org voice; no cost transparency; still $100+/mo |
| **Similarweb** | ~$125/mo cited; higher tiers quote-only ([pricing](https://www.similarweb.com/corp/pricing/)) | Business/enterprise contact-sales | Free trial + limited free tool | Individuals→enterprises | Web/app traffic & digital competitive intel | No profile, no cited idea cards, no cost receipt; benchmarking is traffic, not "orgs like you" |
| **Google Trends** | Free ([Trends](https://trends.google.com/trends/)) | — | Free | Everyone | Search-interest trends | Raw signal only — no synthesis, profile, benchmarking, or execution steps (Volition consumes this kind of data) |
| **Buffer** | Essentials $5/channel/mo ([pricing](https://buffer.com/pricing)) | Team $10/channel/mo; Free (3 channels) | Free plan | Solopreneurs, creators, small teams | Social scheduling + built-in AI Assistant | AI writes captions, doesn't research/benchmark; no citations or cost receipt |
| **Later** | Starter $18.75/mo (annual) ([pricing](https://later.com/pricing/)) | Growth $37.50, Scale $82.50; AI credits included | 14-day trial | Creators, brands, agencies | Visual scheduling + AI captions | Publishing tool, not an intelligence engine; no sourced ideas |
| **Jasper** | Pro $59/mo yearly ($69 monthly) ([pricing](https://www.jasper.ai/pricing)) | Business custom | 7-day trial | Marketing teams, brands | AI marketing copy + brand voice | Generates content, not researched/cited strategy; no live-web citations; no cost receipt |
| **Copy.ai** | Chat $29/mo ([pricing](https://www.copy.ai/prices)) | Enterprise/GTM $2,000/mo | Older free tier n.a. | Small teams→enterprise GTM | AI GTM content + workflow automation | Content/workflow, not sourced market intelligence; no citation enforcement |
| **Predis.ai** | Core $19/mo ([pricing](https://predis.ai/pricing/)) | Rise $40, Enterprise+ $212 | Free trial | SMBs, creators, agencies | AI social posts, images, video | Content generation, not benchmarking/opportunity research; no cited evidence |
| **Talk To Your CMO** (AI CMO) | Quote-only ([site](https://talktoyourcmo.com/)) | — | n.a. | SMBs | AI "CMO" over ads/CRM/analytics, weekly plans | No cited-source enforcement, no cost receipt, no local/private option; requires connecting your stack |
| **Sintra AI** | From $97/mo ([pricing](https://sintra.ai/pricing)) | 1/3/12-mo plans | n.a. | SMBs | AI "helpers"/virtual employees for marketing tasks | Task automation, not sourced intelligence; no citations; cloud-only |
| **HubSpot Breeze AI** | Marketing Hub Pro ~$800/mo ([review](https://talktoyourcmo.com/blog/best-ai-marketing-agents-small-business/)) | — | — | SMB→mid-market on HubSpot | AI agents inside HubSpot CRM | CRM-embedded, expensive, requires HubSpot; not standalone micro-org intelligence |

### Reading the table
- **Two price worlds.** Enterprise listening/intelligence (Brandwatch, Meltwater, Sprout Listening) lives at **$800–$3,000+/month** — categorically off-limits to a club or 12-person coffee shop. SMB tools (Semrush, Similarweb, Jasper, Copy.ai) cluster at **$19–$120+/month**, cheaper but still recurring, and none of them do Volition's job.
- **Capability gaps are consistent.** Across every competitor, the same four things are missing: (1) a **persistent org profile + voice**, (2) **mechanically enforced citations tied to fetched sources**, (3) **comparable-org benchmarking** ("who sponsors clubs like yours"), and (4) **a per-query cost receipt**. Content tools (Jasper/Copy.ai/Predis/Buffer/Later) *write*; intelligence suites (Brandwatch/Meltwater) *listen*; SEO tools (Semrush/Similarweb) *measure traffic*. None *research your world and hand you cited, execution-ready ideas at an audited cost.*
- **Adjacent AI-advisor products** (Talk To Your CMO, Sintra, HubSpot Breeze) are the closest conceptually, but they are cloud-only, uncited, opaque on cost, and often require wiring up your CRM/ad stack — the opposite of Volition's "one text box, self-hostable, $0-marginal" posture.

*Flagged: Sprout Listening add-on price, Similarweb per-plan prices, Jasper Creator tier, Copy.ai legacy tiers, and Talk To Your CMO pricing are all unpublished/quote-only. Brandwatch and Meltwater figures are third-party estimates, not official.*

---

## 3. General LLM Assistants as the Real Competitor

The honest truth: **the real competitor isn't Brandwatch — it's the club president opening ChatGPT.** Judges will ask this, so answer it head-on.

### Their cost
| Assistant | Entry | Top consumer tier | Source |
|---|---|---|---|
| ChatGPT | Plus $20/mo | Pro $200/mo | [OpenAI](https://openai.com/chatgpt/pricing/) |
| Claude | Pro $17/mo | Max from $100/mo | [Anthropic](https://www.anthropic.com/pricing) |
| Perplexity | Pro $17/mo (annual) | Max $167/mo (annual) | [Perplexity](https://www.perplexity.ai/pro) |

A general assistant is a genuinely strong, cheap ($17–$20/mo) tool that many micro-orgs already pay for. Pretending otherwise loses the room.

### Their structural limits for *this* use case
1. **No persistent org profile.** Each session restarts from zero; the user re-explains who they are every time. Volition extracts a structured profile + voice **once** and reuses it (repo `CLAUDE.md`, `DIFFERENTIATION.md`). ChatGPT "memory" is unstructured and not a benchmarking substrate.
2. **No enforced citations tied to fetched sources.** A chatbot can *sound* sourced and still hallucinate URLs. Volition's rule is mechanical: **citation or no card** — the validator drops any IdeaCard whose evidence isn't a real fetched URL (repo core design rule #1).
3. **No comparable-set benchmarking pipeline.** "Which fintechs sponsor university trading clubs and what plays do they run" requires a planned multi-query research run over live sources, ranked against your profile — not a single prompt's recollection.
4. **No per-query cost transparency.** ChatGPT/Claude/Perplexity **never** show what an answer cost ([DIFFERENTIATION.md matrix, repo]). Volition prints a line-item receipt on every run.
5. **Data leaves the user's machine.** Every token in a hosted assistant goes to a vendor's servers. Volition runs ~70% of tokens locally on Ollama at $0 marginal cost, so profile extraction and drafting never leave the device (repo `ARCHITECTURE.md`).
6. **Outputs are unverifiable recollections, not validated live research.** Even with browsing, the output form is prose, not structured, validated, execution-ready cards with fit rationale and steps.

### Steelman: what a general assistant does *better* (rehearse this for hostile judges)
- **Breadth & reasoning.** A frontier model handles any question — legal phrasing, code, a pep-talk to volunteers — not just four idea lanes. Volition is deliberately narrow.
- **Conversational iteration.** "Make it punchier, now in Spanish, now as a tweet" is instant and fluid in a chat UI.
- **Zero setup.** No Ollama install, no hardware, no API keys — the barrier that stops most non-technical users cold (see Section 4/7). ChatGPT is one login.
- **Frontier quality on the hard step.** For genuinely hard synthesis, GPT-5 / Claude Sonnet / Gemini Pro may outreason a local 8B model — which is exactly why Volition *routes the synthesis step to cloud Haiku/Sonnet* rather than pretending local wins everywhere (repo router table).
- **Trust & polish.** Household-name assistants feel safe and finished; a hackathon tool has to earn that.

**The winning framing:** Volition is not "better than ChatGPT at being ChatGPT." It is a **purpose-built, accountable, private, cost-transparent research workflow** for a job general assistants do unreliably — and it *uses* frontier models exactly where they earn their cost, then shows you the bill.

---

## 4. The Moat Analysis

Ranked from most defensible to most copyable. Be honest: most single features are copyable; the defensibility is in the **combination + the mission-aligned posture**, not any one checkbox.

**(e) Comparable-org benchmarking dataset that compounds with use — STRONGEST potential moat.**
Every run enriches a proprietary dataset of "what orgs like this actually do" (sponsors, plays, positioning). If that corpus is retained and structured, it compounds — the classic data-network-effect moat. a16z cautions that raw data volume alone is *not* automatically defensible ([a16z, "The Empty Promise of Data Moats"](https://a16z.com/the-empty-promise-of-data-moats/)), so the defensibility depends on turning runs into a *unique, structured, reused* benchmarking asset, not just logs. **This is the one to invest in.**

**(d) Persistent profile + voice extraction — moderate moat, high retention.**
Copyable in principle, but it creates **switching cost and a system-of-record position** — a16z's own reframing of "the myth of the GPT wrapper" points to owning the end-to-end workflow and being the system of record (Cursor) as the real source of defensibility ([a16z, Casado & Wang](https://a16z.com/podcast/where-value-will-accrue-in-ai-martin-casado-sarah-wang/)). The profile is what makes Volition *yours* and hard to abandon.

**(c) Citation-or-no-card enforced validation — moderate moat as trust/brand.**
Technically copyable, but few competitors *want* to enforce it (it reduces output volume and exposes weak sources). As a **brand promise and product constraint** it's differentiating and mission-aligned; as code it's a weekend feature. Defensibility = reputation, not technology.

**(a) Local-first hybrid routing with $0 marginal inference — economic moat, partly copyable.**
The $0-marginal-cost structure is real and durable *as economics* (Section 5), and the local-LLM movement it rides is massive: **Ollama has 170k+ GitHub stars** ([GitHub Stars Leaderboard](https://githublb.vercel.app/owner/ollama)), **llama.cpp crossed 100k stars** ([AI Haven](https://aihaven.com/news/llama-cpp-100k-stars-github/)), and **Meta Llama passed 1 billion downloads** ([Meta Newsroom](https://about.fb.com/news/2025/03/celebrating-1-billion-downloads-llama/)). But any competitor can adopt the same routing. The moat is **being early + making it invisible to non-technical users**, not the technique.

**(f) Open-source + self-hosting as a wedge — distribution moat, with real risks.**
Open-source/local-first has repeatedly beaten closed incumbents in dev tools and infra: **Linux holds ~63% of the server-OS market and 100% of the TOP500 supercomputers** ([Wikipedia](https://en.wikipedia.org/wiki/Usage_share_of_operating_systems)); **PostgreSQL is the most-used database among developers** ([Stack Overflow 2024](https://survey.stackoverflow.co/2024/)); open-core/open-source companies reached scale — **GitLab IPO'd at an ~$11B valuation** ([MarketWatch](https://www.marketwatch.com/story/gitlab-prices-ipo-at-77-a-share-for-11-billion-valuation-11634172643)), **Grafana Labs is valued over $6B** ([Grafana Labs](https://grafana.com/press/2024/08/21/grafana-labs-soars-past-250m-arr-and-5000-customers-completes-270m-primary-and-secondary-transaction-and-named-a-leader-in-the-gartner-magic-quadrant-for-observability-platforms/)), **Hugging Face at $4.5B** ([Reuters](https://www.reuters.com/technology/ai-startup-hugging-face-valued-45-bln-latest-round-funding-2023-08-24/)). **Honest counter-evidence:** open-source-as-wedge is fragile as a *business* — HashiCorp, Redis, Elastic, and MongoDB all **relicensed away from open source** to defend revenue against cloud incumbents ([HashiCorp BSL](https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license), [Redis SSPL](https://redis.io/blog/redis-adopts-dual-source-available-licensing/), [Elastic](https://www.elastic.co/blog/elasticsearch-is-open-source-again), [MongoDB SSPL](https://www.mongodb.com/company/newsroom/press-releases/mongodb-issues-new-server-side-public-license-for-mongodb-community-server)), and TechTarget frames the "open source monetization dilemma" where a managed-service incumbent captures the revenue the project can't ([TechTarget](https://www.techtarget.com/searchcloudcomputing/opinion/Elastic-vs-AWS-highlights-open-source-monetization-dilemma)). So: open source is a **distribution and trust wedge, not a business moat by itself.**

**Bottom line for judges:** Volition's defensibility is the *stack* — a compounding benchmarking dataset (e) sitting on a sticky profile (d), delivered through an accountable (c), cheap (a), open (f) workflow. No single layer is unbeatable; the *integrated, mission-aligned* product is what a general assistant or a content tool can't casually clone.

---

## 5. Cost-Economics Deep Dive

### Unit prices used (all from official pages, July 2026)
- **Local Ollama inference: $0 marginal** (self-hosted; electricity ignored — say so honestly) ([ollama.com](https://ollama.com/)).
- **Claude Haiku (latest): $1 in / $5 out per MTok; Sonnet (latest): $2 in / $10 out** ([Anthropic](https://www.anthropic.com/pricing)).
- **Cloud-frontier comparators:** GPT-5 flagship $2.50 in / $15 out ([OpenAI](https://platform.openai.com/docs/pricing)); Gemini 2.5 Pro $1.25 in / $10 out ([Google](https://ai.google.dev/gemini-api/docs/pricing)).
- **Tavily search: $0.008/credit PAYG, 1,000 free credits/month** ([Tavily docs](https://docs.tavily.com/documentation/api-credits)).
- **Firecrawl: 1,000 pages/month free; Hobby $16/mo for 5,000 pages** (~$0.0008–0.001/page effective) ([Firecrawl](https://www.firecrawl.dev/pricing)).
- **YouTube Data API: 10,000 units/day free** ([Google](https://developers.google.com/youtube/v3/getting-started)); **Reddit API: 100 queries/min free** ([Reddit](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)).
- **Subscription comparators:** ChatGPT Plus $20/mo, Claude Pro $17/mo, Perplexity Pro $17/mo (above); enterprise listening $199–$399/seat (Sprout) up to $800–$3,000+/mo (Brandwatch/Meltwater).

### Per-query math (one full Volition research run ≈ 8 searches + 4 scrapes)
Per the repo's own metered worked example (`COST_AND_AUDIT.md`), validated against the unit prices above:

| Stage | Provider | Work | Cost (PAYG) | Cost (free tiers) |
|---|---|---|---|---|
| Plan + extract + rank | Ollama (local) | ~15K tokens | $0.000 | $0.000 |
| Search | Tavily ×8 | 8 credits @ $0.008 | $0.064 | $0.000 (within 1,000/mo free) |
| Deep scrape | Firecrawl ×4 | 4 pages | ~$0.004 | $0.000 (within 1,000/mo free) |
| Synthesis | Haiku 4.5 | ~10K in / 2.5K out @ $1/$5 | ~$0.023 | ~$0.023 |
| Drafts | Ollama (local) | ~4K tokens | $0.000 | $0.000 |
| **TOTAL (Haiku path)** | | | **~$0.09/run** | **~$0.03/run** |
| TOTAL (Sonnet synthesis) | Sonnet @ $2/$10 | ~10K/2.5K | **~$0.13/run** | ~$0.10/run |

*Source for token/credit assumptions: repo `COST_AND_AUDIT.md`; unit prices per the official pages cited above. Electricity for local inference is excluded and should be stated as such.*

### Monthly total: a micro-org running ~30 intelligence queries/month

| Option | Monthly cost | Notes | Source |
|---|---|---|---|
| **Volition, free tiers** | **~$0.70–$0.90** | 30 runs × ~$0.03; Tavily/Firecrawl free tiers cover the volume; local inference $0 | repo `COST_AND_AUDIT.md` + [Tavily](https://docs.tavily.com/documentation/api-credits), [Firecrawl](https://www.firecrawl.dev/pricing) |
| **Volition, PAYG (Haiku)** | **~$2.70** | 30 × ~$0.09 | as above |
| **Volition, PAYG (Sonnet boost)** | **~$3.90** | 30 × ~$0.13 | as above |
| **Volition, self-hosted, cloud off** | **~$0.00** | all-local mode, quality trade-off | [ollama.com](https://ollama.com/) |
| ChatGPT Plus | $20.00 | uncited, memoryless, no benchmarking, no receipt | [OpenAI](https://openai.com/chatgpt/pricing/) |
| Claude Pro | $17.00 | same structural gaps | [Anthropic](https://www.anthropic.com/pricing) |
| Perplexity Pro | $17.00 | cited but generic, no profile/benchmarking/receipt | [Perplexity](https://www.perplexity.ai/pro) |
| Predis.ai Core | $19.00 | content generation, not intelligence | [Predis](https://predis.ai/pricing/) |
| Semrush SEO | $117.33 | SEO metrics, not idea cards | [Semrush](https://www.semrush.com/prices/) |
| Sprout Social Standard | $199.00/seat | enterprise social suite | [Sprout](https://sproutsocial.com/pricing/) |
| Brandwatch / Meltwater | ~$800–$3,000+/mo (est.) | enterprise listening | [CheckThat.ai](https://checkthat.ai/brands/brandwatch/pricing), [Vendr](https://www.vendr.com/marketplace/meltwater) |

**The line for the deck:** *A micro-org can run 30 sourced, benchmarked, execution-ready intelligence reports for roughly the cost of a stick of gum — versus $17–$20/month for an uncited chatbot, $117+/month for SEO metrics, or $800–$3,000/month for an enterprise listening seat. And Volition prints the receipt so they can verify it.*

**Honest caveat:** the "$0 self-host" and free-tier figures depend on staying inside Tavily's 1,000 free credits and Firecrawl's 1,000 free pages per month. At ~12 credits/run that's ~80 free runs/month — comfortable for a typical micro-org, but heavy users cross into PAYG (still cents/run). Volition's economics are strongest for the target user, not for a power user running hundreds of runs — a point worth conceding before a judge raises it (see Section 7).

---

## 6. FEE / Free-Market Alignment Angle

The pitch's mission rubric (20%) rewards free-market economics done *correctly*, not sprinkled buzzwords. Here is the rigorous version, tied to the evidence above.

**1. Intelligence is a fixed cost that large firms amortize and small ones can't — an economies-of-scale incumbent moat.**
A Fortune 500 spreads the fixed cost of an insights team across billions in revenue; a 12-person coffee shop or a student club cannot. The data proves the resulting divide: **only ~10% of small businesses use analytics and 54% are "rarely data-driven"** ([Techaisle](https://candidcreative.ca/kb/techaisle-smb-data-adoption-survey)), while **52% have marketing budgets under $1,000/month** ([LocaliQ](https://localiq.com/blog/small-business-marketing-trends-report-2026/)) — and the tools that would help start at $800–$3,000/month ([CheckThat.ai](https://checkthat.ai/brands/brandwatch/pricing)). Volition **collapses the fixed cost to a near-zero variable cost (~$0.03/run)**, dissolving the scale advantage. This is the single strongest free-market claim in the deck.

**2. Hayek's dispersed knowledge — decentralized, locally-run intelligence fits the theory literally.**
Hayek's insight is that useful knowledge is dispersed among individuals "on the spot," not centralizable. Volition runs the *reasoning about your specific local situation* on *your own machine* with *your own context* — ~70% of tokens local (repo `ARCHITECTURE.md`) — rather than funneling every micro-org's private context into one centralized model. It is decentralized cognition, matching decentralized knowledge. The local-LLM movement it rides is real and large (**Llama's 1B downloads** ([Meta](https://about.fb.com/news/2025/03/celebrating-1-billion-downloads-llama/)), **Ollama 170k+ stars** ([leaderboard](https://githublb.vercel.app/owner/ollama))).

**3. Price transparency (the cost receipt) = functioning price signals / Bastiat's seen-and-unseen.**
Prices are information (Hayek); most "AI-powered" tools deliberately hide their unit economics (**none of ChatGPT, Claude, Perplexity, Brandwatch, Sprout ever show cost per answer** — repo `DIFFERENTIATION.md`). Volition's per-query receipt makes the *unseen* cost *seen* (Bastiat), restoring a working price signal so the buyer can make an informed choice. Radical price transparency is a market-functioning feature, not just a UX flourish.

**4. Open-source + model-agnostic routing = competition among AI providers, not monopoly dependence.**
Because Volition is open (Apache-2.0/MIT) and routes to whichever model is "cheapest capable," it treats frontier models as **interchangeable suppliers competing on price/quality** rather than a single gatekeeper. This is market competition doing its job — and it has precedent: open ecosystems displaced closed incumbents in servers (**Linux ~63%** ([Wikipedia](https://en.wikipedia.org/wiki/Usage_share_of_operating_systems))) and databases (**PostgreSQL #1** ([Stack Overflow](https://survey.stackoverflow.co/2024/))). No permission, no lock-in, no gatekeeper.

**5. "Prosperity accessible to everyone" — democratizing a capability, not redistributing anything.**
This is the FEE-perfect framing: Volition doesn't take an insights team *from* the Fortune 500 and give it to the club — it **creates a new, cheap capability** that anyone can run. Positive-sum, not zero-sum. The addressable population is enormous — **36.2M US small businesses** ([SBA](https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/)), **~1.9M nonprofits** ([Candid](https://candid.org/impact-insights/us-social-sector/)), plus hundreds of thousands of student/sports groups ([NCES](https://nces.ed.gov/fastfacts/display.asp?id=84), [NFHS](https://nfhs.org/stories/participation-in-high-school-sports-hits-record-high-with-sizable-increase-in-2024-25)) — and the tool empowers each to compete on their own merits.

**Strongest evidence points to lead with (from §1–5):**
- **$0.03/run vs. $800–$3,000/month** — the raw leveling-the-playing-field number.
- **~10% of small businesses use analytics; 54% rarely data-driven** — proof the gap is real and huge.
- **52% of small businesses spend <$1,000/month on marketing; smallest orgs 55% more likely to be under $500/month** — proof they're priced out today.
- **36.2M small businesses + 1.9M nonprofits** — the scale of who gets empowered.
- **The cost receipt** — the one feature no competitor offers, and a literal price signal.

---

## 7. Risks & Honest Weaknesses

| Objection a judge could raise | Best evidence-based response |
|---|---|
| **"An 8B local model is far weaker than GPT-5/Sonnet — quality will suffer."** | Concede it for hard synthesis — that's *why the architecture routes synthesis to cloud Haiku/Sonnet, not local* (repo router table). Local handles structured extraction, planning, and ranking, where small models are adequate; the eval harness (`scripts/eval.ts`) benchmarks local-vs-cloud field-accuracy to prove parity on those stages. And the gap is closing fast: the top frontier models on Chatbot Arena sit within ~44 Elo points, and open-weight vs. closed on SWE-bench Verified is under 8 points ([2026 AI Index via Gentic News](https://gentic.news/article/ai-model-race-tightens-10-labs-now)). |
| **"You depend on free API tiers that can vanish or get metered."** | True and disclosed. At ~12 credits/run, Tavily's 1,000 free credits ([Tavily](https://docs.tavily.com/documentation/api-credits)) and Firecrawl's 1,000 free pages ([Firecrawl](https://www.firecrawl.dev/pricing)) cover ~80 runs/month. Beyond that it's PAYG at cents/run (~$0.09), still 200× cheaper than a Sprout seat. The cost model degrades gracefully into paid tiers rather than breaking. |
| **"Social/data APIs keep getting locked down (Reddit, Twitter)."** | Real risk. Volition already uses the *sanctioned* free tiers — Reddit's official API (100 queries/min free, [Reddit](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)) and YouTube's 10,000 units/day ([Google](https://developers.google.com/youtube/v3/getting-started)) — not fragile access. The model-agnostic, source-agnostic pipeline means a locked-down source is swapped, not fatal; Tavily/Firecrawl provide general web coverage independent of any one platform. |
| **"Incumbents will just add a cost receipt / citations / local option."** | Possible for any single feature, but (a) enterprise vendors are structurally *disincentivized* to show cost per answer or reduce output by enforcing citations, and (b) the moat is the *combination* + the compounding benchmarking dataset (§4), not one checkbox. Open source lets Volition move faster than a $6B-suite's roadmap. |
| **"This is a thin GPT wrapper."** | The most dangerous framing — answer directly. a16z's own reframing says defensibility comes from owning the end-to-end workflow, being the system of record, and proprietary data — not the model ([a16z](https://a16z.com/podcast/where-value-will-accrue-in-ai-martin-casado-sarah-wang/)). Volition owns a **persistent profile, an enforced-citation research pipeline, a comparable-org dataset, and a metered cost layer** — none of which is a wrapper. It also *isn't* a single-model wrapper: ~70% of work is local, cloud is an optional boost. |
| **"Self-hosting is too hard for a club president."** | Legitimate — self-hosting is a documented adoption barrier for non-technical users ([USENIX 2023](https://www.usenix.org/system/files/usenixsecurity23-grober.pdf); practitioner reports, [Latenode](https://community.latenode.com/t/can-non-technical-teams-actually-own-automation-workflows-on-self-hosted-deployments-without-constant-engineering-support/59368)). Mitigation: self-hosting is the *ideological wedge*, but the hosted ~$19/mo option (repo) is the *default path* for non-technical users. Open source guarantees no lock-in; hosting guarantees no friction. Offer both. |
| **"Open source can't build a durable business."** | Honest history: HashiCorp, Redis, Elastic, MongoDB all relicensed away from OSI-open to defend revenue ([HashiCorp](https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license), [Redis](https://redis.io/blog/redis-adopts-dual-source-available-licensing/)). But those are *infra* companies fighting cloud giants reselling their software. Volition's business is the **hosted convenience + the benchmarking dataset**, not the code — and permissive licensing is a distribution/trust wedge for a hackathon-stage tool, not the monetization plan. |

---

## Executive Summary — 10 bullets for the pitch deck

1. **The buyer set is the largest and most underserved in marketing-tech:** 36.2M US small businesses ([SBA](https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/)), ~1.9M nonprofits ([Candid](https://candid.org/impact-insights/us-social-sector/)), 98k+ K-12 schools ([NCES](https://nces.ed.gov/fastfacts/display.asp?id=84)), and 8.3M high-school athletes ([NFHS](https://nfhs.org/stories/participation-in-high-school-sports-hits-record-high-with-sizable-increase-in-2024-25)).
2. **They're priced out of intelligence today:** only ~10% of small businesses use analytics and 54% are "rarely data-driven" ([Techaisle](https://candidcreative.ca/kb/techaisle-smb-data-adoption-survey)); 52% spend under $1,000/month on marketing ([LocaliQ](https://localiq.com/blog/small-business-marketing-trends-report-2026/)).
3. **The tools that would help are enterprise-priced:** Brandwatch/Meltwater run ~$800–$3,000+/month ([CheckThat.ai](https://checkthat.ai/brands/brandwatch/pricing), [Vendr](https://www.vendr.com/marketplace/meltwater)); Sprout is $199–$399/seat ([Sprout](https://sproutsocial.com/pricing/)).
4. **Volition runs a full sourced, benchmarked research report for ~$0.03–$0.13** and ~30 reports/month for under $3 ([repo cost model](https://www.firecrawl.dev/pricing) + [Tavily](https://docs.tavily.com/documentation/api-credits), [Anthropic](https://www.anthropic.com/pricing)) — a fixed cost turned into pennies of variable cost.
5. **The real competitor is ChatGPT ($20/mo), Claude/Perplexity ($17/mo)** — cheap and strong, but structurally unable to keep a persistent org profile, enforce source-tied citations, benchmark comparable orgs, or show cost per answer ([OpenAI](https://openai.com/chatgpt/pricing/), [Anthropic](https://www.anthropic.com/pricing), [Perplexity](https://www.perplexity.ai/pro)).
6. **Volition's four irreducible differentiators:** persistent profile + voice, citation-or-no-card validation, comparable-org benchmarking, and a per-query cost receipt — none of which any competitor in our teardown offers together.
7. **The moat is the stack, not a feature:** a compounding benchmarking dataset on a sticky profile, delivered through an accountable, cheap, open workflow — a16z's own thesis says defensibility comes from owning the workflow and data, not the model ([a16z](https://a16z.com/podcast/where-value-will-accrue-in-ai-martin-casado-sarah-wang/)).
8. **Open + local-first has beaten closed incumbents before** — Linux ~63% of servers ([Wikipedia](https://en.wikipedia.org/wiki/Usage_share_of_operating_systems)), PostgreSQL the #1 developer database ([Stack Overflow](https://survey.stackoverflow.co/2024/)), Grafana $6B+ ([Grafana Labs](https://grafana.com/press/2024/08/21/grafana-labs-soars-past-250m-arr-and-5000-customers-completes-270m-primary-and-secondary-transaction-and-named-a-leader-in-the-gartner-magic-quadrant-for-observability-platforms/)) — and the local-LLM wave is here (Llama 1B downloads ([Meta](https://about.fb.com/news/2025/03/celebrating-1-billion-downloads-llama/))).
9. **Mission fit is literal, not decorative:** the cost receipt is a working price signal (Hayek/Bastiat), local processing is decentralized knowledge, model-agnostic routing is provider competition over monopoly dependence, and the whole thing *creates* a capability for everyone rather than redistributing one.
10. **We name our own weaknesses:** local-model quality (mitigated by cloud-routed synthesis + a closing benchmark gap, [AI Index](https://gentic.news/article/ai-model-race-tightens-10-labs-now)), free-tier limits (graceful PAYG at cents/run), and self-hosting friction (hosted default + open-source guarantee) — and we have an evidence-based answer to each.

---

*Verification flags: (1) License is Apache-2.0 in the repo vs. MIT in the brief — reconcile. (2) Default local model is qwen3:8b in the repo vs. Llama 3.1 8B in the brief. (3) Brandwatch/Meltwater prices are third-party estimates (quote-only officially). (4) National counts of college/K-12 clubs and SMB willingness-to-pay for CI tools could not be verified from primary sources and are presented as illustrative, not cited. (5) Volition per-run token/credit assumptions come from the repo's own cost doc; unit prices are from official vendor pages as of July 2026.*
