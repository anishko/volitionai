# Volition -- https://www.volition.works
Grounded intelligence for mission-driven organizations — nonprofits,
advocacy groups, associations, and clubs. Volition finds the donors,
sponsors, and events they run on, cites the evidence, and shows you the
receipt. Same engine serves any small org. It researches your world
(trends, comparable orgs, opportunities) and returns cited,
execution-ready ideas, with the true cost of every answer printed on
the answer. Built as a proprietary product on open AI infrastructure.

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

### Nonprofit Events (auth + profiles) env
The nonprofit events surface (/login, /onboarding, /events) needs a
Supabase project with the migrations in supabase/ applied and Google
OAuth enabled (Supabase Dashboard → Auth → Providers → Google; app
redirect URL is `<site>/auth/callback`):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY  (server-only: query_costs ledger writes)

Without these, the legacy demo at / keeps working and /login shows a
"not configured" notice.

## Docs
CLAUDE.md (context) · docs/ARCHITECTURE.md · docs/DATA_SOURCES.md ·
docs/COST_AND_AUDIT.md · docs/DIFFERENTIATION.md · docs/DEMO.md

