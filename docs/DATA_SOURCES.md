# Data sources — what we use, what it costs, what we skip and why

## In (verify prices before pitch; last checked Jul 7 2026)
| Source | Cost | Role | Notes |
|---|---|---|---|
| Tavily | 1,000 free credits/mo; basic search = 1 credit; PAYG $0.008/credit; FREE FOR STUDENTS | Primary search + extraction, LLM-ready JSON | Apply for student tier today |
| Firecrawl | Free 500 credits to start; ~$0.83/1K extractions on Standard ($99/mo, 100K credits) | Deep scrape of JS-heavy pages Tavily can't extract | Use sparingly, top 3-5 URLs per run |
| YouTube Data API | Free, 10,000 units/day (search ≈ 100 units → ~100 searches/day) | Content-trend lane: what's rising for this audience | Google Cloud key, no billing needed |
| Reddit API | Free tier for modest OAuth usage | Community signal per niche | Respect rate limits; hackathon volume is fine |
| Federal Register / LegiScan | Free / free tier | Minor law lane | Carried over from earlier design |

## Out (deliberately — this is a pitch slide, not a shortfall)
| Source | Why skipped |
|---|---|
| X API | Pay-per-use only for new devs since Feb 2026 (~$0.005/post read, ~$5 per 1K tweets, 2M read cap, no free tier). Antithetical to our cost thesis. Trend signal reachable via Tavily news + YouTube + Reddit instead. |
| Instagram Graph API | Requires business-account linkage + Meta app review — weeks, not hours. Post-hackathon roadmap item. |
| TikTok | No practical open API for this use. Roadmap. |

Judge line: "We route around the two most expensive social APIs on
the market and still deliver the trend signal — that's the point of
the product: intelligence without the enterprise toll."
