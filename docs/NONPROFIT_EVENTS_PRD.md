# Nonprofit Events Finder — Product Requirements Document (v3)

> **v3 amendment (design partner #2).** A second in-person interview with a
> civil-rights / legal-reform nonprofit — one that runs on a fixed annual
> conference budget and lives or dies by board-justifiable spend — validated
> four additions: (1) a **budget-capped annual planning mode** (propose a set
> of events whose total *cited* cost fits a cap, exportable as a board
> artifact), (2) **ROI fields** (certificates/CE credits; virtual events as
> first-class matches under budget pressure), (3) a **civil-liberties cause
> sub-taxonomy** the matcher filters on, and (4) promotion of the **post-event
> debrief** from out-of-scope to v1.5 (schema landed now). Schema deltas ship
> as follow-up migration `supabase/migrations/20260707000700_*` (the 000100–
> 000600 migrations are already applied and are not edited).

## What this is

A tool that helps nonprofit development directors and marketing directors find
relevant conferences and events where their next donors already are — then plan
their participation down to the deadline. Built as an extension of the Volition
codebase and carrying Volition's core guarantees: every claim cited, every cost
metered, sensitive data processed locally.

One-liner: "Find the rooms where your next donors already are."

Origin: validated in person at FreedomFest 2026 by a national
government-accountability nonprofit (~1,300 case requests/year) whose words
became our enemy statement: **"Existing tools give articles and motivation —
not actionable leads."** They are design partner candidate #1.

Design partner candidate #2: a civil-rights / legal-reform nonprofit (criminal
legal reform, child welfare, fourth-amendment / over-policing, exoneration,
eminent domain, homeless defense) that plans its whole year against a **fixed
annual conference budget** and must justify every trip to a board. Their words:
**"I can find events. What I can't do is prove to my board that this slate of
conferences is the right spend for the year."** That reframed the product from
a per-event finder into an annual, budget-capped *plan* with a defensible,
sourced total — see "Budget-capped annual planning" below.

---

## Positioning and differentiation (why this wins)

The incumbent set fails the same way for every nonprofit:

| Alternative | What it gives | What it can't do |
|---|---|---|
| Candid / nonprofit media | Articles, motivation, sector news | No leads: no event names, deadlines, contacts, or donor signals |
| Generic nonprofit conferences | Rooms full of *other nonprofits* | Competing supply, not donor demand — the user told us this verbatim |
| ChatGPT / Claude / Perplexity | Plausible suggestions from training data | No persistent org profile, no verified deadlines/contacts, hallucinated event details, no cost transparency |
| Event platforms (Eventbrite etc.) | Listings | No issue-area matching, no donor-presence signals, no plan/checklist layer |

Our four irreducible differentiators (inherited from Volition, adapted):

1. **Citation or no signal.** Every deadline, contact, sponsor, speaker, and
   donor signal carries a source URL and a `scraped_at`/`verified_at` stamp,
   enforced by a validator stage in code — not a prompt suggestion. Fields
   that can't be sourced are omitted, never guessed. Trust is the product;
   a development director acting on a fake deadline is a churned customer.
2. **Persistent org profile + voice.** Extracted once (form + website
   enrichment + optional past content), reused for every match and every
   outreach draft. The profile is the system of record and the switching cost.
3. **Compounding events corpus.** The `events` table is shared
   infrastructure: every scrape, deadline extraction, and 990 cross-reference
   any user triggers enriches the corpus for every future user. Match #1,000
   is better than match #1. This is the data moat — the seed list starts it,
   usage compounds it.
4. **Metered, transparent cost.** Every pipeline stage emits a `CostEvent`.
   V1 surfaces a subtle per-run receipt ("This match run cost $0.11") in the
   feed footer and a monthly cost view in Settings. Rationale: cost
   transparency is Volition's signature trust feature; hiding it in v1 gives
   it up for nothing. Keep it quiet in the UI, but keep it.

Wedge GTM: liberty-movement and advocacy nonprofits first (warm network from
FreedomFest, high event/donor intensity, underserved), then the broader
501(c)(3)/(c)(4)/association market.

---

## Target user

Development director or marketing director at a nonprofit of any size.
Primary outcome: donor prospect meetings at events.
Secondary outcomes: speaking slots (visibility), sponsorships placed
efficiently, no missed deadlines.

Personas for design/demo:
- "Liberty Legal Aid" (fictional): national government-accountability
  nonprofit; issue areas child welfare, eminent domain, homeless defense;
  goals: issue-aligned conferences to sponsor, in-person donor conversion,
  campaigns timed to legislative calendars.
- "Fourth Amendment Defense Project" (fictional, design partner #2): national
  civil-rights / legal-reform nonprofit with a **hard annual conference budget
  cap (e.g. $40,000 for period "2027")**; cause sub-tags: criminal legal
  reform, fourth amendment / over-policing, exoneration, eminent domain,
  homeless defense; goal: assemble the *year's* slate of events whose total
  cited cost fits the cap and defend it to the board; budget-sensitive, so
  values certificates/CE credit and treats virtual events as first-class.
- Small local education nonprofit (<$500k budget): one-person development
  "team," needs the tool to be the whole department.

---

## Core pages

| Route | Purpose |
|---|---|
| `/onboarding` | One-time structured form to build org profile |
| `/events` | Main feed with "For You" and "Saved" tabs + run receipt footer |
| `/events/[id]` | Event detail: logistics, contacts, participation tiers, donor signals — all cited |
| `/plan` | Active event plans with deadline checklists + calendar sync |
| `/plan/annual` | Budget-capped annual planning: matched-event slate whose total cited cost fits the cap, running total vs cap, manual swap in/out, "Annual Conference Plan" export |
| `/outreach/[matchId]` | Drafted outreach (sponsor pitch, CFP abstract, intro email) in org voice — copy/export only |
| `/profile` | Edit onboarding data + uploaded context as the org evolves |
| `/settings` | Account, calendar integration toggle, monthly cost view, data controls |

Onboarding is a one-time flow that precedes the nav.
After onboarding, Events is the homepage.
Nav shows three items only: Events, Plan, Profile.
Settings and Outreach live under contextual entry points, not nav items.

---

## Auth

Google OAuth only (most nonprofits run on Google Workspace).
Supabase handles session persistence. Google Calendar scope requested
lazily — only when the user first taps "Sync to Calendar," not at signup
(scope creep at signup kills conversion).
Profile, saved events, plans, and cost history are tied to the
authenticated user. RLS on all per-user tables.

---

## Onboarding form (8 fields + 2 optional uploads)

1. **Org name + website** — used for auto-enrichment: Firecrawl scrapes the
   public site; local LLM extracts mission language, programs, and tone.
2. **Cause area** — multi-select: education, environment, health, housing,
   youth, arts, human services, civil liberties / government accountability,
   faith-based, other. (Civil liberties added — our wedge segment must not
   have to pick "other.") When **civil liberties / government accountability**
   is selected, reveal **cause sub-tags** (multi-select, stored in
   `cause_sub_tags`): criminal legal reform, child welfare, fourth amendment /
   over-policing, exoneration, eminent domain, homeless defense. The matcher
   filters on sub-tags when present, falling back to top-level cause areas.
4b. **Annual conference budget (optional)** — a cap amount + a period label
   (e.g. $40,000 for "2027"), stored as `annual_budget_cap` + `budget_period`.
   When set, it powers `/plan/annual`; nullable for orgs that don't plan
   against a hard cap.
3. **Geographic focus** — local / regional / national / international +
   freetext region/city.
4. **Org size** — budget range: under $500k / $500k–$2M / $2M–$10M / $10M+.
5. **Current donor mix** — checkboxes: individual donors, foundations,
   corporate sponsors, government grants.
6. **Target donor type** — same checkboxes (what they want more of).
7. **Primary goal** — radio: grow individual donors / land foundation
   grants / find corporate sponsors / increase visibility / find speaking
   opportunities.
8. **Open-ended notes** — "Anything else we should know?"

Optional uploads (both processed by the LOCAL model, raw files discarded
after extraction — the Volition privacy rule):
- **Past content** (newsletters, appeal letters, social posts) → voice
  extraction for outreach drafting.
- **Bring Your Numbers** (donor export CSV — amounts, dates, zips; no names
  required) → structured facts only: average gift size, donor geography
  concentration, seasonality. These facts sharpen matching ("your donors
  cluster in the Southeast — this Atlanta event scores higher") and never
  leave the machine as raw data.

After submission, LLM extracts a structured `NonprofitProfile` from fields +
notes + enrichment and stores it in Supabase. Uploaded raw files are parsed
and discarded; only extracted facts persist. Uploads are treated as
untrusted data — instructions inside documents are never executed.

---

## Data sources

### Seed database (curated, static)
Hand-curated list of 50–100 recurring nonprofit/philanthropy conferences:
AFP International (ICON), GivingTuesday Summit, NTC (NTEN), Council on
Foundations, Independent Sector, BoardSource, Nonprofit Finance Fund
Summit, plus wedge-segment events: FreedomFest, SPN Annual Meeting,
LibertyCon, parental-rights and civil-liberties convenings.
Stored in Supabase `events` table (`is_seed = true`), refreshed annually.
Seed rows still require source URLs — the citation rule has no exceptions.

### Live search (Tavily + Firecrawl)
Tavily queries for long-tail and niche events not in the seed list —
this is where we beat every directory, because niche issue-area events
("eminent domain reform conference," "child welfare policy summit") are
exactly what the user cannot find today.
Firecrawl deep-scrapes event pages to extract:
- Registration deadline
- CFP (call for proposals) deadline
- Early bird pricing cutoff
- Sponsorship application deadline
- Speaker list
- Sponsor list
- Organizer contacts
Every extracted field stores `source_url` + `scraped_at`.

Budget caps (Volition rule): per-match-run ceiling of 20 Tavily credits and
15 Firecrawl pages, hard-stopped in code and logged. Partial results with a
"we stopped at budget" note beat runaway costs.

### 990 cross-reference (ProPublica Nonprofit Explorer API)
Free REST API, no key required.
Used to infer donor presence signals:
- Which foundations gave to orgs in this cause area + geography
- Cross-reference those foundations against event sponsors/speakers
- Produces: "Ford Foundation has historically supported education orgs in
  Illinois and sponsored this event in 2024" — with links to both the 990
  filing and the event sponsor page.

### Timing intelligence (v1.5 — stub the data model now)
State legislative session calendars (LegiScan, free tier) as a planning
signal for advocacy orgs: "Arkansas legislature convenes Jan 12 — events
and campaigns in the preceding two weeks have outsized impact." Directly
requested behavior from our design-partner interview (their documentary
screening the night before the session). V1 ships the `timing_signals`
JSONB column empty; v1.5 fills it.

Out of scope for v1: attendee rosters behind registration walls. Public
speaker and sponsor signals are sufficient. Never scrape behind auth.

---

## Event matching pipeline

Reuses Volition's hybrid LLM routing (qwen3:8b local with `think: false`;
nomic-embed-text available locally for similarity ranking) with new stages:

| Stage | Model / tool | Why |
|---|---|---|
| Query planning | LOCAL qwen3:8b | Turn nonprofit profile into 6–10 Tavily search queries |
| Event scraping | Firecrawl | Extract structured event data from pages |
| 990 enrichment | ProPublica API (free) | Donor presence signals |
| Candidate filtering | Rules (code) | Cause-area overlap (sub-tag overlap when the profile has `cause_sub_tags`, else top-level cause areas) + geography radius before any LLM runs. When the profile signals budget sensitivity (low `org_size` or a set `annual_budget_cap`), **virtual events are first-class candidates**, not down-ranked for being remote |
| Similarity ranking | LOCAL nomic-embed-text | Rank filtered candidates against profile embedding — free, fast |
| Match explanation | CLOUD claude-haiku-4-5 | Profile-aware "why attend" copy for top 10–20 finalists |
| **Validation** | Rules (code) | **Citation or no signal**: drop any field lacking `source_url`; drop any match whose explanation references unsourced facts; stamp `verified_at` |
| Outreach drafting (on demand) | LOCAL qwen3:8b | Sponsor pitch / CFP abstract / intro email in org voice |

Rules filter runs before the LLM so cloud spend only touches finalists.
Every Anthropic, Tavily, and Firecrawl call emits a `CostEvent` (logged to
`query_costs` AND summarized in a per-run receipt shown in the feed footer).

Date grounding: current date injected into every prompt; the model may only
reference present/future timeframes (learned the hard way at the hackathon).

Staleness policy: re-scrape an event if `last_scraped_at` > 30 days, or > 7
days when any known deadline falls within 45 days. Deadline urgency in the
UI always displays the `verified_at` date ("closes in 14 days — verified
Jul 5").

Dedupe: events keyed on normalized website domain + name + year; live-search
hits matching a seed row merge into it rather than duplicating.

---

## Event card (events page)

Rich card showing:
- Event name, date, location
- Cause area tags
- Match score (0–100)
- 2–3 sentence profile-aware "why you should attend" blurb (unique per org)
- Donor signal callout: "Ford Foundation sponsored this event in 2024" —
  callout is tappable, revealing both source links
- Participation tier icons: attendee / speaker / sponsor available
- Certificates / CE-credit badge when `certificates_offered` is populated
  (each entry `{type, source_url}` — badge is tappable to its source; no
  source, no badge). An ROI signal that matters most to budget-capped orgs.
- Deadline urgency indicator with verification stamp: "Registration closes
  in 14 days · verified Jul 5"

Card actions:
- **Save** — moves to Saved tab
- **Dismiss** — removes from feed (dismissals logged; they train nothing in
  v1 but the column exists for the v2 feedback loop)
- **Add to Plan** — creates a plan entry and kicks off checklist generation
- **Draft outreach** — opens `/outreach/[matchId]` with tier-appropriate
  drafts

Feed footer: subtle receipt line — "This match run: $0.11 · 62% of tokens
local · details" — expanding to the stage-by-stage breakdown. Quiet, but
present. It is the trust signature.

Events page has two tabs: "For You" (recommended) and "Saved."
Default sort: match score descending, with urgency bump for events whose
nearest deadline falls within 30 days.
Empty state: "No strong matches this run" is an acceptable, honest result —
never pad the feed with weak matches to look busy.

---

## Event detail page (`/events/[id]`)

Every section renders its facts with source links and `verified_at` stamps.
A field without a source does not render — the validator guarantees this
upstream, the UI enforces it downstream.

### Logistics
- Full date range, venue name, city/state
- Website URL
- Format: in-person / virtual / hybrid

### How to participate
Three participation tier cards (attendee / speaker / sponsor), each showing:
- Cost or fee
- Deadline (+ verified date)
- How to apply / register (URL + instructions scraped from event page)

### Organizer contacts
- Registration coordinator (name, email, LinkedIn if public)
- Sponsorship lead
- Speaker selection committee contact
Provenance rule: contacts display only what is publicly listed, with the
page it came from linked. No inferred or pattern-guessed emails — a bounced
guess burns user trust and sender reputation.

### Known attendees and speakers
- Confirmed speakers: name, title, org, LinkedIn URL
- Known sponsors: org name, CSR contact if publicly findable

### Donor signals
- Foundations cross-referenced via 990 that have historically engaged with
  this event
- Each signal: foundation name, program officer name if public, giving
  focus area, links to the 990 filing and the event page that ties them

### Timing signals (v1.5)
- Legislative session proximity for advocacy-relevant events

---

## Outreach drafting (`/outreach/[matchId]`)

The "prep the send" pattern from Volition: **the AI prepares, the human
pulls the trigger.** No email is ever sent by the system.

Given a match + tier, the local model drafts in the org's extracted voice:
- **Sponsor pitch email** to the sponsorship lead (references the org's
  mission, the event's audience, and — if Bring Your Numbers ran — one
  concrete supporting fact)
- **CFP abstract** (speaking tier) shaped to the event's themes
- **Intro/meeting-request email** to a donor-signal program officer

Each draft shows the evidence it drew on (linked) and ships as copy-to-
clipboard + .eml download. Drafting runs local → $0 marginal, unlimited
regenerations.

---

## Planning feature (`/plan`)

Each saved plan is tied to one event and one participation tier
(attending / speaking / sponsoring).

### Checklist templates

**Attending:**
- [ ] Register for event (deadline: auto-filled + source link)
- [ ] Book travel (suggested: 60 days before)
- [ ] Book hotel (suggested: 60 days before)
- [ ] Research attendees and speakers to prioritize
- [ ] Prepare 30-second org pitch (link to outreach drafts)
- [ ] Identify 3 donor prospects to meet (pre-seeded from donor signals)

**Speaking:** all attending tasks, plus:
- [ ] Submit CFP (deadline: auto-filled + source link)
- [ ] Confirm speaking slot accepted
- [ ] Prepare talk / slides
- [ ] Prep post-talk follow-up materials

**Sponsoring:** all attending tasks, plus:
- [ ] Submit sponsorship application (deadline: auto-filled + source link)
- [ ] Design booth or branded materials
- [ ] Prepare sponsor activation plan

Custom tasks can be added to any checklist.
Auto-filled deadlines display their source and verified date; if a scrape
can't find a deadline, the task renders with "deadline unknown — check
event site" rather than a guessed date.

### Google Calendar sync
Each checklist item with a date can be pushed to Google Calendar.
Calendar scope requested at first use. One-click "Sync all deadlines."
Sync is explicit and user-initiated every time — consistent with the
no-autonomous-actions rule. Synced events store `calendar_event_id` for
update/removal on checklist change.

---

## Budget-capped annual planning (`/plan/annual`) — new core feature, v1

Design partner #2's core job: assemble the *year's* slate of conferences whose
total cost fits a fixed budget and defend that slate to a board. This is the
annual, budget-capped counterpart to the per-event `/plan`.

Inputs: the profile's `annual_budget_cap` + `budget_period`, and the org's
matched/saved events. Each candidate entry carries two cost components:

- **Registration cost** — SOURCED. Snapshotted from the chosen participation
  tier's cited cost (`events.participation_tiers[].cost` + `source_url` +
  `verified_at`). If a tier's cost isn't scrapeable, the entry shows "cost
  unknown — check event site," never a guess, and is excluded from the total
  until sourced.
- **Estimated travel cost** — an ESTIMATE. Stored in
  `event_plans.estimated_travel_cost`, **always labeled "estimate" in the UI**
  and visually distinct from cited numbers. Never carries a source_url (it
  isn't a scraped fact); the citation rule is not violated because it is never
  presented as sourced.

Surface behavior:
- Given the profile + cap, propose a set of matched events whose **total cited
  cost (+ labeled travel estimates) fits the cap**, ranked by match score.
- Display the **running total vs cap** live; over-cap is flagged, not blocked.
- Swap events in and out manually; totals recompute.
- Honest empty/partial states: if too few cap-fitting events clear the score
  threshold, say so — never pad the slate to look full.

**Export — "Annual Conference Plan"** (`/api/plans/annual/export`): a clean
printable page / PDF that is a **budget-justification artifact for a founder or
board**. Contents: org name, budget period, **total vs cap**, and per event:
name, date, cost (with source link), why-attend, and certificates/CE credits.
Tone is factual; every number is either sourced (with its link) or explicitly
labeled "estimate." No motivational filler — this is a document a director
hands a board.

## Data model (Supabase tables)

### `nonprofit_profiles`
```
id uuid pk
user_id uuid fk (auth.users)
org_name text
website text
cause_areas text[]
cause_sub_tags text[]         -- v3: civil-liberties sub-taxonomy; matcher filters on these when present
annual_budget_cap numeric     -- v3: annual conference budget cap (nullable)
budget_period text            -- v3: period label for the cap, e.g. "2027"
geography_focus text          -- "local" | "regional" | "national" | "international"
geography_detail text
org_size text
current_donor_mix text[]
target_donor_type text[]
primary_goal text
open_ended_notes text
extracted_profile jsonb       -- LLM-structured profile used for matching
voice_profile jsonb           -- tone/voice facts from past-content upload (nullable)
internal_facts jsonb          -- Bring Your Numbers extracted facts (nullable; never raw data)
created_at timestamptz
updated_at timestamptz
```

### `events`  (shared corpus — the moat table)
```
id uuid pk
name text
website text
start_date date
end_date date
location_city text
location_state text
location_country text
format text                   -- "in_person" | "virtual" | "hybrid"
cause_area_tags text[]
cause_sub_tags text[]         -- v3: sub-taxonomy tags on events; matcher filters on these when present
certificates_offered jsonb   -- v3 ROI: [{type, source_url}] scraped where available; drives the certificates badge
is_seed boolean
speakers jsonb                -- [{name, title, org, linkedin_url, source_url}]
sponsors jsonb                -- [{name, csr_contact, linkedin_url, source_url}]
organizer_contacts jsonb      -- [{role, name, email, linkedin_url, source_url}]
participation_tiers jsonb     -- [{tier, cost, deadline, apply_url, instructions, source_url, verified_at}]
donor_signals jsonb           -- [{foundation_name, program_officer, focus_area, filing_url, event_source_url}]
timing_signals jsonb          -- v1.5: [{jurisdiction, session_start, source_url}]
raw_scrape_data jsonb         -- full Firecrawl output, kept for re-processing
scrape_count int default 1    -- corpus-compounding metric
last_scraped_at timestamptz
created_at timestamptz
unique(website, name, start_date)
```

### `event_matches`
```
id uuid pk
profile_id uuid fk
event_id uuid fk
match_score int
why_attend text
donor_signal_callout text
evidence jsonb                -- [{claim, source_url}] backing the explanation
status text                   -- "recommended" | "saved" | "dismissed"
dismissed_reason text         -- nullable; v2 feedback loop
created_at timestamptz
```

### `event_plans`
```
id uuid pk
profile_id uuid fk
event_id uuid fk
participation_tier text
checklist jsonb               -- [{task, deadline, deadline_source_url, completed, calendar_event_id}]
budget_period text            -- v3: groups plans into one annual plan for /plan/annual
registration_cost numeric     -- v3: SOURCED snapshot of the chosen tier's cited cost
registration_cost_source_url text        -- v3: citation for registration_cost
registration_cost_verified_at timestamptz -- v3: when that cost was verified
estimated_travel_cost numeric -- v3: ESTIMATE only; UI must label "estimate", never cited
calendar_synced_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `event_debriefs`  (v1.5 — schema now, no UI yet)
```
id uuid pk
plan_id uuid fk (event_plans)
worth_it int                  -- 1-5, "was attending worth it?" (feeds v2 feedback loop)
notes text
created_at timestamptz
```
Owner-scoped RLS via plan → profile → user. No UI in v1.5 (see MOCKED.md).

### `outreach_drafts`
```
id uuid pk
match_id uuid fk (event_matches)
draft_type text               -- "sponsor_pitch" | "cfp_abstract" | "intro_email"
body text
evidence jsonb                -- [{claim, source_url}]
model_route text              -- "local" | "cloud" | "fallback:cloud"
created_at timestamptz
```

### `query_costs` (reuse existing Volition table)
```
+ run_type text               -- "event_match" | "idea_generation" | "outreach_draft" | "event_scrape"
+ entity_id uuid              -- profile_id for event_match runs
```

---

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/nonprofit/profile` | POST | Create profile; runs local extraction; discards raw uploads |
| `/api/nonprofit/profile` | GET | Fetch current user's profile |
| `/api/nonprofit/profile` | PATCH | Update profile fields |
| `/api/events/match` | POST | Run matching pipeline; enforces budget caps; returns matches + receipt |
| `/api/events/[id]` | GET | Event detail + donor signals (validated fields only) |
| `/api/events/[id]/scrape` | POST | Re-scrape event page (respects staleness policy; metered) |
| `/api/matches/[id]` | PATCH | Update match status (saved/dismissed + optional reason) |
| `/api/outreach` | POST | Generate draft for match + type (local model) |
| `/api/plans` | GET | List all plans for current user |
| `/api/plans` | POST | Create plan from match + tier; generates checklist |
| `/api/plans/[id]` | PATCH | Update checklist (incl. `estimated_travel_cost`) |
| `/api/plans/[id]/calendar` | POST | Push deadlines to Google Calendar (explicit, user-initiated) |
| `/api/plans/annual` | GET | Current annual plan for a `budget_period`: entries, running total vs cap |
| `/api/plans/annual` | POST | Propose a cap-fitting slate for the profile + period (cited registration costs + travel estimates); ranked by match score |
| `/api/plans/annual/export` | GET | "Annual Conference Plan" printable page / PDF (board budget-justification artifact) |
| `/api/costs/summary` | GET | Monthly cost rollup for Settings view |

---

## Success metrics (v1)

- Activation: % of signups completing onboarding → first match run
- Time-to-first-save: median minutes from onboarding to first saved event
- Core value: saved events per active org per month; plans created
- Outcome proxy: checklist "Identify 3 donor prospects" completion rate;
  self-reported meetings booked (single post-event prompt)
- Trust: broken-source-link reports per 100 rendered signals (target ~0)
- Unit economics: median cost per match run (target ≤ $0.15) — measurable
  because every stage is metered

---

## Failure modes and edge cases (build these in, don't discover them)

- Scrape fails / page is JS-walled → event renders with whatever fields have
  sources; missing fields say "not found," never guessed
- No matches clear the score threshold → honest empty state + suggestion to
  broaden geography or cause areas
- Dead source link detected on render → field flagged "source unavailable,
  re-verifying," background re-scrape queued
- Budget cap hit mid-run → partial results + note, receipt shows the stop
- Ollama unavailable (hosted deployment) → cloud fallback, `fallback:cloud`
  logged on receipt; never silent
- Duplicate events across seed + live search → merged by unique key
- Uploaded CSV is garbage/malicious → local parse fails gracefully;
  instructions inside documents never executed
- Event date passed → auto-archived from feeds; a plan becomes eligible for a
  v1.5 debrief (`event_debriefs` row; no UI prompt until v1.5)

---

## What is explicitly out of scope for v1

- Post-event debrief **UI** (promoted to v1.5; the `event_debriefs` table
  ships now, no UI yet — see MOCKED.md) and the recommendation feedback loop
  it feeds (still v2; `dismissed_reason` and plan completion data collected now)
- Full 990 donor-signal UI (v1 shows public speaker/sponsor signals;
  990 enrichment logs to `donor_signals` and surfaces where available)
- Cross-org aggregated *insights* (the shared events corpus is v1; derived
  analytics like "orgs like you attended X" are v2)
- Timing intelligence UI (v1.5; column stubbed now)
- Auto-sent outreach of any kind (never; drafts only)
- Pricing, billing, subscription management
- Mobile-optimized layout beyond responsive basics
- Attendee rosters behind registration walls

---

## Build phases and task breakdown

### Phase 0 — Foundation (reuse Volition infrastructure)
- [ ] Stand up Supabase project (hackathon build was local-JSON; this
      product needs real persistence) + Google OAuth
- [ ] Migrations: `nonprofit_profiles`, `events`, `event_matches`,
      `event_plans`, `outreach_drafts`; extend `query_costs`
- [ ] v3 follow-up migration `20260707000700_*` (additive; base migrations
      already applied): budget cap + `cause_sub_tags` on profiles; sub-tags,
      `certificates_offered` on events; budget/cost fields on `event_plans`;
      new `event_debriefs` table
- [ ] Extend `types/index.ts`: `NonprofitProfile`, `Event`, `EventMatch`,
      `EventPlan`, `OutreachDraft`, `Evidence`
- [ ] Extend `PipelineStage`: `event_search`, `event_scrape`,
      `event_match`, `donor_signal`, `outreach_draft`
- [ ] Seed `events` table (50–100 conferences, CSV import, source URLs
      mandatory; include wedge-segment events)
- [ ] Port Volition validator into a shared `lib/validate.ts` with the
      field-level source_url rule
- [ ] MOCKED.md carried over: anything stubbed is labeled in-UI and listed

### Phase 1 — Auth and onboarding
- [ ] `/onboarding` 8-field form (shadcn/ui) + optional uploads (past
      content, donor CSV) with "processed locally, raw file discarded" copy
- [ ] `POST /api/nonprofit/profile` — form + website enrichment + local
      extraction (voice + internal facts); raw uploads discarded
- [ ] `GET` / `PATCH` profile routes; `/profile` edit page reusing form
- [ ] Post-onboarding redirect to `/events`

### Phase 2 — Event matching pipeline
- [ ] Query planner (LOCAL qwen3:8b, think:false, date-grounded)
- [ ] Tavily event search handler (budget-capped, metered)
- [ ] Firecrawl event page scraper → structured fields + source_url +
      scraped_at on every field
- [ ] ProPublica 990 enrichment + sponsor/speaker cross-reference
- [ ] Rules candidate filter (cause overlap + geography) →
      nomic-embed-text similarity ranking
- [ ] Match explainer (CLOUD haiku) with evidence array
- [ ] Validator stage: citation-or-no-signal enforcement, verified_at stamps
- [ ] `POST /api/events/match` orchestration + per-run receipt
- [ ] Staleness + dedupe logic; CostEvent at every stage

### Phase 3 — Events page
- [ ] EventCard (score, blurb, tappable donor-signal callout, tier icons,
      urgency + verified stamp)
- [ ] Save / Dismiss (with optional reason) / Add to Plan / Draft outreach
      actions, optimistic updates
- [ ] "For You" / "Saved" tabs; skeleton states; honest empty state
- [ ] Receipt footer with expandable breakdown
- [ ] `PATCH /api/matches/[id]`

### Phase 4 — Event detail page
- [ ] `/events/[id]` with all sections; every field renders source link +
      verified date; unsourced fields don't render
- [ ] Re-scrape button wired to staleness policy

### Phase 5 — Outreach drafting
- [ ] `POST /api/outreach` (local model, org voice, evidence-linked)
- [ ] `/outreach/[matchId]` page: three draft types, regenerate, copy +
      .eml export; visible "you send it — we never do" note

### Phase 6 — Planning feature
- [ ] `POST /api/plans` + tier checklist templates with auto-filled,
      source-linked deadlines ("deadline unknown" when unscrapable)
- [ ] Firecrawl date extractor
- [ ] `/plan` page: expandable checklists, complete/add tasks
- [ ] `PATCH /api/plans/[id]`
- [ ] Calendar sync: lazy scope request, `POST /api/plans/[id]/calendar`,
      "Sync all deadlines" button, calendar_event_id tracking
- [ ] Budget-capped annual planning: `/plan/annual` surface, cap-fitting
      slate proposal ranked by score, running total vs cap, manual swap
      in/out, `estimated_travel_cost` capture (labeled "estimate")
- [ ] `GET`/`POST /api/plans/annual`; `GET /api/plans/annual/export`
      ("Annual Conference Plan" printable/PDF board artifact — every number
      sourced or labeled estimate)
- [ ] Certificates/CE badge from `certificates_offered`; virtual-first-class
      matching when the profile signals budget sensitivity

### Phase 7 — Polish and trust pass
- [ ] `/settings`: calendar toggle, account, monthly cost view
      (`GET /api/costs/summary`), data controls (delete profile + facts)
- [ ] Loading states, error boundaries, empty states everywhere
- [ ] Dead-link detection on render + re-verify queue
- [ ] Verify every CostEvent path; verify no unsourced field can render
- [ ] Accessibility pass

---

## Reuse from Volition

| Volition piece | How it maps |
|---|---|
| `types/cost.ts` CostEvent + CostReceipt | Reuse directly; new PipelineStage values; receipt footer UI |
| `lib/ai/prices.ts` | Reuse directly (keep verifiedAt discipline) |
| Ollama local routing (qwen3:8b, think:false) | Query planner, outreach drafting; nomic-embed-text for ranking |
| Citation-or-no-card validator | Generalized to field-level citation-or-no-signal in `lib/validate.ts` |
| Tavily search handler | Event discovery queries (budget caps carried over) |
| Firecrawl scraper | Event page deep-scrape |
| Date-grounding prompt pattern | All planning/explanation prompts |
| Cached-fixture demo insurance | Demo mode for sales calls: `?cached=1` personas |
| Profile + voice extraction, raw-discard privacy rule | Onboarding uploads |
| "Prep the send" pattern | Outreach drafts: AI prepares, human sends |
| MOCKED.md honesty discipline | Carried into this repo |
| shadcn/ui card components | EventCard from IdeaCard pattern |
| `query_costs` table | Extended with `run_type` + `entity_id` |
