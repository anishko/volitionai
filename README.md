# Volition
A proprietary insights team on demand, built on open AI
infrastructure. Tell Volition what you are —
a school club, a small business, a sports team — and it researches
your world (trends, comparable orgs, opportunities) and returns
cited, execution-ready ideas, with the true cost of every answer
printed on the answer.

Proprietary · Built on open infrastructure · FEE Hackathon 2026 · Team Volition

## Why it's not a chatbot
Persistent org profile + voice · mechanically enforced citations ·
hybrid local/cloud LLM routing (roughly half of tokens run locally at $0 —
the exact split is printed on every receipt; synthesis routes to the
cheapest capable cloud model by default, Haiku) ·
per-query cost receipts · comparable-org benchmarking · open-weight
local models, model-agnostic router, no vendor lock-in.

## Setup
1. git clone https://github.com/anishko/volitionai.git && cd volitionai
2. npm install
3. Install Ollama (ollama.com) then:
   ollama pull qwen3:8b && ollama pull nomic-embed-text
4. cp .env.example .env.local  (keys from Anish in WhatsApp)
5. npm run dev → http://localhost:3000

## Docs
CLAUDE.md (context) · docs/ARCHITECTURE.md · docs/DATA_SOURCES.md ·
docs/COST_AND_AUDIT.md · docs/DIFFERENTIATION.md · docs/DEMO.md

## Working agreement
Branch per person → PR → gh pr merge N --rebase. Citation or no
card. Every provider call emits a CostEvent. Mocks labeled in
MOCKED.md.
