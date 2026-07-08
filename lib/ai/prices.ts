// SOURCE OF TRUTH for the cost meter. Verify before pitch:
// Anthropic: platform.claude.com/docs pricing | Tavily: docs.tavily.com/documentation/api-credits
export const PRICES = {
  anthropic: {
    "claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
    "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  },
  ollama: { anyModel: { inputPerMTok: 0, outputPerMTok: 0 } }, // $0 marginal; say "electricity excluded" if asked
  tavily: { perBasicSearchUsd: 0.008 },     // $0 within free/student tier — meter logs list price with tierFree flag
  firecrawl: { perPageUsd: 0.001 },
  propublica: { perCallUsd: 0 },            // free public API, no key — metered for the audit trail
  meetup: { perCallUsd: 0 },                // official Meetup API, free — metered for the audit trail
  youtube: { perSearchUsd: 0 },
  reddit: { perCallUsd: 0 },
} as const;
