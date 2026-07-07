# Architecture

## Design goal
Simplest possible interface on top of a serious pipeline. The user
sees: one question, one optional upload, one dashboard. Everything
below is invisible to them and visible to judges.

## Hybrid LLM routing (the cost + privacy story)
Every AI task is routed by a static table — cheapest capable model
wins. Local = Ollama on our hardware, $0 marginal.

| Stage                 | Model                  | Why |
|-----------------------|------------------------|-----|
| Profile extraction    | LOCAL qwen3:8b         | Structured JSON from text; small model is enough; user docs never leave the machine |
| Voice extraction      | LOCAL qwen3:8b         | Style summary from past posts |
| Query planning        | LOCAL qwen3:8b         | Turns profile+goals into 6-10 search queries |
| Embeddings/ranking    | LOCAL nomic-embed-text | Rank fetched evidence vs profile, $0 |
| Evidence → IdeaCards  | CLOUD claude-haiku-4-5 default; claude-sonnet-4-6 behind QUALITY=high flag | Synthesis with strict citations is the one quality-critical step |
| "Draft it" content    | LOCAL qwen3:8b         | Voice mimicry is a local-model strength; instant + free |

Fallbacks: if Ollama is unreachable, route local stages to Haiku
and log the cost difference (the meter makes the fallback visible).
Low-RAM machines: OLLAMA_MODEL=llama3.2:3b.

## Pipeline (per run)
1. PLAN (local): profile + goals → research plan {queries[], lanes[]}
2. FETCH (parallel): Tavily search per query; Firecrawl only for
   top URLs needing full-page depth; YouTube search for content
   trends; Reddit search for community signal. Each result carries
   {url, title, snippet, publishedAt, source}.
3. RANK (local embeddings): score evidence against profile; drop
   stale (>90d unless evergreen) and low-relevance items.
4. SYNTHESIZE (cloud): top evidence → IdeaCard[]. Hard rules in
   prompt: every card cites >=1 evidence URL from the provided set
   (never invented); if a lane lacks evidence, return no card for
   that lane; JSON only.
5. VALIDATE (code, not model): zod-parse; reject any card whose
   evidence URL is not in the fetched set (kills hallucinated
   citations mechanically, not by trust).
6. METER: every stage emitted CostEvents; roll up and store; return
   totalCostUsd with the payload; UI renders the receipt.

## Failure endpoints (tested, not hoped)
- Ollama down → cloud fallback + visible cost delta
- Tavily/Firecrawl error or empty → lane degrades, never fabricates
- Zod parse fail → one retry with error feedback → then partial
  results with honest "some lanes unavailable"
- Prompt injection in uploads → extraction prompt treats doc as data;
  validator strips URLs not in fetched set anyway
- Offline demo → FIXTURES=true serves a pre-recorded full run
  (labeled "cached demo data" in UI per honesty rule)
