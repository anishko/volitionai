# Nonprofit Events Finder - Product Requirements Document

## What this is

A tool that helps nonprofit development directors and marketing directors find
relevant conferences and events to attend for donor prospect meetings.
Built as an extension of the Volition codebase.

One-liner: "Find the rooms where your next donors already are."

---

## Target user

Development director or marketing director at a nonprofit of any size.
Primary outcome they want: donor prospect meetings at events.

---

## Core pages

| Route | Purpose |
|---|---|
| `/onboarding` | One-time structured form to build org profile |
| `/events` | Main feed with "For You" and "Saved" tabs |
| `/events/[id]` | Event detail: logistics, contacts, participation tiers, donor signals |
| `/plan` | Active event plans with deadline checklists + calendar sync |
| `/profile` | Edit onboarding data as the org evolves |
| `/settings` | Account management, calendar integration toggle |

Onboarding is a one-time flow that precedes the nav.
After onboarding, Events is the homepage.
Nav shows three items only: Events, Plan, Profile.
Settings lives under a profile dropdown, not a nav item.

---

## Auth

Google OAuth only (most nonprofits run on Google Workspace).
Supabase handles session persistence.
Profile, saved events, and plans are all tied to the authenticated user.

---

## Onboarding form (8 fields)

1. **Org name + website** - used for auto-enrichment from public site
2. **Cause area** - multi-select: education, environment, health, housing, youth, arts, human services, other
3. **Geographic focus** - local / regional / national / international + freetext region/city
4. **Org size** - budget range: under $500k / $500k-$2M / $2M-$10M / $10M+
5. **Current donor mix** - checkboxes: individual donors, foundations, corporate sponsors, government grants
6. **Target donor type** - same checkboxes as above (what they want more of)
7. **Primary goal** - radio: grow individual donors / land foundation grants / find corporate sponsors / increase visibility / find speaking opportunities
8. **Open-ended notes** - "Anything else we should know about your org or what you're looking for?"

After form submission, LLM extracts a structured `NonprofitProfile` from fields + notes and stores in Supabase.

---

## Data sources

### Seed database (curated, static)
A hand-curated list of 50-100 recurring nonprofit/philanthropy conferences:
AFP International, GivingTuesday Summit, NTC (NTEN), Council on Foundations,
Independent Sector, BoardSource, Nonprofit Finance Fund Summit, etc.
Stored in Supabase `events` table, refreshed annually.

### Live search (Tavily + Firecrawl)
Tavily queries for long-tail and niche events not in the seed list.
Firecrawl for deep-scraping event pages to extract:
- Registration deadline
- CFP (call for proposals) deadline
- Early bird pricing cutoff
- Sponsorship application deadline
- Speaker list
- Sponsor list

### 990 cross-reference (ProPublica Nonprofit Explorer API)
Free REST API, no key required.
Used to infer donor presence signals:
- Which foundations gave to orgs in this cause area + geography
- Cross-reference those foundations against event sponsors/speakers
- Produces: "Ford Foundation has historically supported education orgs in Illinois
  and sponsored this event in 2024"

Note: Attendee rosters behind registration walls are out of scope for v1.
Public speaker and sponsor signals are sufficient.

---

## Event matching pipeline

Reuses Volition's hybrid LLM routing table with new stages:

| Stage | Model | Why |
|---|---|---|
| Query planning | LOCAL qwen3:8b | Turn nonprofit profile into 6-10 Tavily search queries |
| Event scraping | Firecrawl | Extract structured event data from pages |
| 990 enrichment | ProPublica API (free) | Donor presence signals |
| Candidate filtering | Rules (code) | Filter by cause area tag + geography before LLM runs |
| Match explanation | CLOUD claude-haiku-4-5 | Profile-aware "why attend" copy for top 10-20 finalists |

Rules filter: cause area must overlap + geography radius must match.
LLM only runs on the filtered finalist set to generate the personalized explanation.
Every Anthropic and Tavily/Firecrawl call emits a `CostEvent` (logged to Supabase, not shown in UI for v1).

---

## Event card (events page)

Rich card showing:
- Event name, date, location
- Cause area tags
- Match score (0-100)
- 2-3 sentence profile-aware "why you should attend" blurb (unique per org)
- Donor signal callout: "Ford Foundation sponsored this event in 2024"
- Participation tier icons: attendee / speaker / sponsor available
- Deadline urgency indicator: "Registration closes in 14 days"

Card actions:
- **Save** - moves to Saved tab for later
- **Dismiss** - removes from feed
- **Add to Plan** - creates a plan entry and kicks off checklist generation

Events page has two tabs: "For You" (recommended) and "Saved" (bookmarked).
Default sort: match score descending, with urgency bump for events closing within 30 days.

---

## Event detail page (`/events/[id]`)

Sections:

### Logistics
- Full date range, venue name, city/state
- Website URL
- Format: in-person / virtual / hybrid

### How to participate
Three participation tier cards (attendee / speaker / sponsor), each showing:
- Cost or fee
- Deadline
- How to apply / register (URL + instructions scraped from event page)

### Organizer contacts
- Registration coordinator (name, email, LinkedIn if public)
- Sponsorship lead
- Speaker selection committee contact

### Known attendees and speakers
- Confirmed speakers: name, title, org, LinkedIn URL
- Known sponsors: org name, CSR contact if findable

### Donor signals
- Foundations cross-referenced via 990 that have historically engaged with this event
- Each signal: foundation name, program officer name if public, giving focus area, LinkedIn

---

## Planning feature (`/plan`)

Each saved plan is tied to one event and one participation tier (attending / speaking / sponsoring).

### Checklist templates

**Attending:**
- [ ] Register for event (deadline: auto-filled)
- [ ] Book travel (suggested: 60 days before)
- [ ] Book hotel (suggested: 60 days before)
- [ ] Research attendees and speakers to prioritize
- [ ] Prepare 30-second org pitch
- [ ] Identify 3 donor prospects to meet

**Speaking:**
All attending tasks, plus:
- [ ] Submit CFP (deadline: auto-filled)
- [ ] Confirm speaking slot accepted
- [ ] Prepare talk / slides
- [ ] Prep post-talk follow-up materials

**Sponsoring:**
All attending tasks, plus:
- [ ] Submit sponsorship application (deadline: auto-filled)
- [ ] Design booth or branded materials
- [ ] Prepare sponsor activation plan

Custom tasks can be added to any checklist.
Deadlines auto-filled from Firecrawl scrape of event page.

### Google Calendar sync
Each checklist item with a date can be pushed to Google Calendar.
Requires Google Calendar OAuth scope added alongside Google Auth.
One-click "Sync all deadlines to Calendar" button on plan page.

---

## Data model (Supabase tables)

### `nonprofit_profiles`
```
id uuid pk
user_id uuid fk (auth.users)
org_name text
website text
cause_areas text[]
geography_focus text          -- "local" | "regional" | "national" | "international"
geography_detail text         -- freetext city/region
org_size text                 -- budget range bucket
current_donor_mix text[]
target_donor_type text[]
primary_goal text
open_ended_notes text
extracted_profile jsonb       -- LLM-structured profile used for matching
created_at timestamptz
updated_at timestamptz
```

### `events`
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
is_seed boolean               -- true = curated seed list; false = discovered via live search
speakers jsonb                -- [{name, title, org, linkedin_url}]
sponsors jsonb                -- [{name, csr_contact, linkedin_url}]
organizer_contacts jsonb      -- [{role, name, email, linkedin_url}]
participation_tiers jsonb     -- [{tier, cost, deadline, apply_url, instructions}]
donor_signals jsonb           -- [{foundation_name, program_officer, focus_area, linkedin_url}]
raw_scrape_data jsonb         -- full Firecrawl output, kept for re-processing
last_scraped_at timestamptz
created_at timestamptz
```

### `event_matches`
```
id uuid pk
profile_id uuid fk (nonprofit_profiles)
event_id uuid fk (events)
match_score int               -- 0-100
why_attend text               -- profile-aware LLM explanation
donor_signal_callout text     -- single most compelling donor signal sentence
status text                   -- "recommended" | "saved" | "dismissed"
created_at timestamptz
```

### `event_plans`
```
id uuid pk
profile_id uuid fk (nonprofit_profiles)
event_id uuid fk (events)
participation_tier text       -- "attending" | "speaking" | "sponsoring"
checklist jsonb               -- [{task, deadline, completed, calendar_event_id}]
calendar_synced_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `query_costs` (reuse existing Volition table)
```
+ run_type text               -- "event_match" | "idea_generation" (new column)
+ entity_id uuid              -- profile_id for event_match runs
```

---

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/nonprofit/profile` | POST | Create profile from onboarding form |
| `/api/nonprofit/profile` | GET | Fetch current user's profile |
| `/api/nonprofit/profile` | PATCH | Update profile fields |
| `/api/events/match` | POST | Run matching pipeline for current profile |
| `/api/events/[id]` | GET | Fetch event detail + donor signals |
| `/api/events/[id]/scrape` | POST | Re-scrape event page for fresh data |
| `/api/matches/[id]` | PATCH | Update match status (saved/dismissed) |
| `/api/plans` | GET | List all plans for current user |
| `/api/plans` | POST | Create plan from match + participation tier |
| `/api/plans/[id]` | PATCH | Update checklist (complete task, add task) |
| `/api/plans/[id]/calendar` | POST | Sync plan deadlines to Google Calendar |

---

## Build phases and task breakdown

### Phase 0 - Foundation (reuse Volition infrastructure)
- [ ] Add Google Calendar OAuth scope to existing Google Auth config
- [ ] Create Supabase migrations for new tables: `nonprofit_profiles`, `events`, `event_matches`, `event_plans`
- [ ] Add `run_type` and `entity_id` columns to existing `query_costs` table
- [ ] Extend `types/index.ts` with `NonprofitProfile`, `Event`, `EventMatch`, `EventPlan` types
- [ ] Extend `types/cost.ts` `PipelineStage` with: `event_search`, `event_scrape`, `event_match`, `donor_signal`
- [ ] Seed `events` table with 50-100 curated nonprofit conferences (CSV import)

### Phase 1 - Auth and onboarding
- [ ] Build `/onboarding` page with 8-field structured form (shadcn/ui components)
- [ ] Build `POST /api/nonprofit/profile` route - saves form data + runs local LLM extraction
- [ ] Build `GET /api/nonprofit/profile` route - returns profile for current user
- [ ] Post-onboarding redirect to `/events` after profile creation
- [ ] Build `/profile` page to edit existing profile (reuse form components from onboarding)

### Phase 2 - Event matching pipeline
- [ ] Build query planner (LOCAL qwen3:8b) - turns nonprofit profile into Tavily search queries
- [ ] Build Tavily event search handler - queries for events not in seed database
- [ ] Build Firecrawl event page scraper - extracts speakers, sponsors, deadlines, contacts
- [ ] Build ProPublica 990 enrichment - cross-reference foundations with event sponsors/speakers
- [ ] Build rules-based candidate filter - cause area overlap + geography radius
- [ ] Build LLM match explainer (CLOUD claude-haiku-4-5) - profile-aware "why attend" + donor signal callout
- [ ] Build `POST /api/events/match` route - orchestrates full pipeline, stores results in `event_matches`
- [ ] Add CostEvent emission at every pipeline stage, log to `query_costs`

### Phase 3 - Events page
- [ ] Build EventCard component: name, date, location, tags, match score, "why attend" blurb, donor signal callout, tier icons, urgency indicator
- [ ] Build Save / Dismiss / Add to Plan actions on card (optimistic UI updates)
- [ ] Build `/events` page with "For You" / "Saved" tabs
- [ ] Build `PATCH /api/matches/[id]` route for status updates
- [ ] Trigger match pipeline on first visit after onboarding; show skeleton states while loading

### Phase 4 - Event detail page
- [ ] Build `/events/[id]` page
- [ ] Logistics section: date, venue, format, website
- [ ] Participation tiers section: three cards (attending/speaking/sponsoring) with cost, deadline, apply URL
- [ ] Organizer contacts section: role, name, email, LinkedIn
- [ ] Known speakers + sponsors section
- [ ] Donor signals section: foundation name, program officer, focus area, LinkedIn

### Phase 5 - Planning feature
- [ ] Build `POST /api/plans` route - creates plan, generates checklist from template + auto-filled dates
- [ ] Build checklist template logic per participation tier (attending/speaking/sponsoring)
- [ ] Build Firecrawl-powered date extractor - parses event page for registration/CFP/sponsorship deadlines
- [ ] Build `/plan` page - list of active plans with expandable checklist per plan
- [ ] Build checklist UI: complete task toggle, add custom task, show auto-filled vs manual dates
- [ ] Build `PATCH /api/plans/[id]` route - update checklist state
- [ ] Build `POST /api/plans/[id]/calendar` route - push deadlines to Google Calendar
- [ ] Build "Sync to Calendar" button on plan page

### Phase 6 - Polish
- [ ] Build `/settings` page with calendar integration toggle and account management
- [ ] Add loading states and error boundaries to all pages
- [ ] Add empty states (no events matched, no plans yet)
- [ ] Ensure all CostEvents are logged; verify no costs surface in UI
- [ ] Accessibility pass on all new components

---

## What is explicitly out of scope for v1

- Post-event debrief and recommendation feedback loop (v2)
- 990 pipeline donor signal display (v1 uses public speaker/sponsor signals only; 990 enrichment logs to `donor_signals` JSONB column but UI shows it as enhancement if available)
- Aggregated cross-org signals (single-tenant only)
- Pricing, billing, subscription management
- Mobile-optimized layout beyond responsive basics
- Attendee rosters behind registration walls

---

## Reuse from Volition

| Volition piece | How it maps |
|---|---|
| `types/cost.ts` CostEvent + CostReceipt | Reuse directly, add new PipelineStage values |
| `lib/ai/prices.ts` | Reuse directly |
| Ollama local routing | Query planner + match explainer draft stage |
| Tavily search handler | Event discovery queries |
| Firecrawl scraper | Event page deep-scrape |
| Supabase client + auth | Profile storage, session, plans |
| shadcn/ui card components | EventCard built from IdeaCard pattern |
| `query_costs` table | Extended with `run_type` + `entity_id` columns |
