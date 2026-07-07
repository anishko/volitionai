-- Seed events corpus: hand-curated recurring nonprofit / philanthropy
-- conferences (issue #2; docs/NONPROFIT_EVENTS_PRD.md "Seed database").
--
-- Rules:
-- - Every row is a real event with a live website URL; the website is the
--   source for every field in the row (the citation rule has no exceptions).
--   Dates and locations were verified against the event site or 2026
--   conference roundups on 2026-07-07. Unannounced dates are NULL, never
--   guessed; Firecrawl fills them later with field-level source_urls.
-- - Idempotent: re-running upserts on the (website, name, start_date) dedupe
--   key. Only curation-owned fields are updated on conflict; enrichment-owned
--   columns (speakers, sponsors, participation_tiers, donor_signals,
--   raw_scrape_data, scrape_count) are never touched, so re-seeding cannot
--   clobber scraped data.
-- - cause_area_tags vocabulary (PRD onboarding): education, environment,
--   health, housing, youth, arts, human_services, civil_liberties,
--   faith_based. Sector-wide fundraising/philanthropy events carry all seven
--   standard cause areas because they are relevant to orgs of any cause.
-- - Refresh cadence: annually (update dates to the next edition, re-run).

insert into public.events
  (name, website, start_date, end_date, location_city, location_state, location_country, format, cause_area_tags, is_seed)
values
  -- ── Cross-sector fundraising and nonprofit-management conferences ──
  ('AFP ICON 2026', 'https://afpglobal.org/afp-icon', '2026-04-26', '2026-04-28', 'San Diego', 'CA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('AFP LEAD 2026', 'https://afpglobal.org/conferences-0', '2026-10-22', '2026-10-24', 'New Orleans', 'LA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Nonprofit Technology Conference (NTC) 2026', 'https://www.nten.org/gather', '2026-03-10', '2026-03-13', 'Detroit', 'MI', 'USA', 'hybrid', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Peer-to-Peer Professional Forum Conference 2026', 'https://www.peertopeerforum.com/', '2026-02-24', '2026-02-26', 'Baltimore', 'MD', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('GivingTuesday Summit 2026', 'https://www.givingtuesday.org/', '2026-04-06', '2026-04-08', 'Washington', 'DC', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Council on Foundations Building Together 2026', 'https://cof.org/building-together-2026', '2026-05-04', '2026-05-07', 'Seattle', 'WA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Classy Collaborative 2026', 'https://collaborative.classy.org/', '2026-05-06', '2026-05-07', 'Chicago', 'IL', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('GiveCon 2026', 'https://bloomerang.com/givecon/', '2026-05-17', '2026-05-20', 'St. Louis', 'MO', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Respond 2026 (Virtuous)', 'https://respond.virtuous.org/', '2026-05-27', '2026-05-29', 'Dallas', 'TX', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Responsive Nonprofit Summit 2026', 'https://virtuous.org/rns/', '2026-03-11', '2026-03-12', null, null, 'USA', 'virtual', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('GEO 2026 National Conference', 'https://www.geofunders.org/event/2026-national-conference/', '2026-06-01', '2026-06-03', 'Boston', 'MA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Social Innovation Summit 2026', 'https://www.socialinnovation.com/', '2026-06-02', '2026-06-03', 'Atlanta', 'GA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('AICPA & CIMA Not-for-Profit Industry Conference 2026', 'https://www.aicpa-cima.com/cpe-learning/conference/aicpa-cima-not-for-profit-industry-conference', '2026-06-15', '2026-06-17', 'National Harbor', 'MD', 'USA', 'hybrid', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Points of Light Conference 2026', 'https://www.pointsoflight.org/points-of-light-conference/', '2026-06-22', '2026-06-25', 'Washington', 'DC', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Engage for Good 2026', 'https://engageforgood.com/conference/', '2026-04-21', '2026-04-24', 'Palm Springs', 'CA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Bridge to Integrated Marketing and Fundraising Conference 2026', 'https://www.bridgeconf.org/', '2026-07-29', '2026-07-31', 'National Harbor', 'MD', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Nonprofit Innovation & Optimization (NIO) Summit 2026', 'https://www.niosummit.com/', '2026-09-22', '2026-09-24', 'Fort Worth', 'TX', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('bbcon 2026', 'https://www.bbconference.com/', '2026-09-29', '2026-10-01', 'Columbus', 'OH', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Nonprofit Storytelling Conference 2026', 'https://nonprofitstorytellingconference.com/', '2026-10-26', '2026-10-28', 'Tucson', 'AZ', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('GrantSummit 2026 (Grant Professionals Association)', 'https://grantprofessionals.org/page/grantsummit2026', '2026-11-04', '2026-11-07', 'San Antonio', 'TX', 'USA', 'hybrid', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Exponent Philanthropy Annual Conference 2026', 'https://exponentphilanthropy.org/event/2026-annual-conference/', '2026-11-11', '2026-11-13', 'Portland', 'OR', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Philanthropy Roundtable Annual Meeting 2026', 'https://www.philanthropyroundtable.org/2026-annual-meeting/', '2026-10-21', '2026-10-23', null, null, 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Upswell Summit (Independent Sector)', 'https://upswell.org/', null, null, 'Atlanta', 'GA', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('BoardSource Leadership Forum', 'https://boardsource.org/', null, null, null, null, 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Nonprofit Finance Fund Summit', 'https://nff.org/', null, null, null, null, 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Good Tech Fest', 'https://www.goodtechfest.com/', null, null, null, null, 'USA', 'virtual', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Alabama Association of Nonprofits Summit 2026', 'https://www.alabamanonprofits.org/', '2026-02-03', '2026-02-04', 'Montgomery', 'AL', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),
  ('Together SC Nonprofit Summit 2026', 'https://www.togethersc.org/', '2026-03-09', '2026-03-11', 'Greenville', 'SC', 'USA', 'in_person', '{education,environment,health,housing,youth,arts,human_services}', true),

  -- ── Education ──
  ('SXSW EDU 2026', 'https://sxswedu.com/', '2026-03-09', '2026-03-12', 'Austin', 'TX', 'USA', 'in_person', '{education}', true),
  ('CASE Summit for Leaders in Advancement 2026', 'https://www.case.org/conferences-training/summit-leaders-advancement-2026', null, null, 'Seattle', 'WA', 'USA', 'in_person', '{education}', true),
  ('CASE Conference for Community College Advancement 2026', 'https://www.case.org/conferences-training/case-conference-community-college-advancement-2026', null, null, null, null, 'USA', 'in_person', '{education}', true),
  ('Blackbaud K-12 User Conference 2026', 'https://www.blackbaud.com/events', '2026-07-15', '2026-07-17', 'Boston', 'MA', 'USA', 'in_person', '{education}', true),

  -- ── Environment ──
  ('Rally 2026: The National Land Conservation Conference', 'https://landtrustalliance.org/resources/connect/rally-the-national-land-conservation-conference', '2026-09-16', '2026-09-19', 'Denver', 'CO', 'USA', 'in_person', '{environment}', true),
  ('River Rally 2026', 'https://www.rivernetwork.org/connect-learn/river-rally/', '2026-05-11', '2026-05-14', 'San Antonio', 'TX', 'USA', 'in_person', '{environment}', true),

  -- ── Health ──
  ('AHP Annual International Conference 2026', 'https://www.ahp.org/events/internationalconference', '2026-10-07', '2026-10-09', 'Nashville', 'TN', 'USA', 'in_person', '{health}', true),
  ('NEAHP Annual Educational Conference 2026', 'https://www.neahp.org/', '2026-03-02', '2026-03-04', 'Portland', 'ME', 'USA', 'in_person', '{health}', true),

  -- ── Housing ──
  ('NLIHC Housing Policy Forum 2026', 'https://nlihc.org/events/2026-nlihc-housing-policy-forum', '2026-03-10', '2026-03-13', 'Washington', 'DC', 'USA', 'in_person', '{housing}', true),
  ('National Conference on Ending Homelessness 2026', 'https://endhomelessness.org/conferences/', '2026-07-08', '2026-07-10', 'Washington', 'DC', 'USA', 'in_person', '{housing,human_services}', true),
  ('Habitat on the Hill 2026', 'https://www.habitat.org/about/advocacy/habitat-on-the-hill', '2026-02-10', '2026-02-12', 'Washington', 'DC', 'USA', 'in_person', '{housing}', true),

  -- ── Youth ──
  ('National Mentoring Summit 2026', 'https://mentoring.org/national-mentoring-summit/', '2026-02-04', '2026-02-06', 'Washington', 'DC', 'USA', 'in_person', '{youth,education}', true),
  ('Boys & Girls Clubs of America National Conference 2026', 'https://bgcaboards.org/events/2026-national-conference/', '2026-04-28', '2026-05-01', 'Charlotte', 'NC', 'USA', 'in_person', '{youth}', true),
  ('National AfterSchool Association Convention 2026', 'https://naaweb.org/page/NAAConvention', '2026-03-11', '2026-03-14', 'National Harbor', 'MD', 'USA', 'in_person', '{youth,education}', true),

  -- ── Arts ──
  ('AFTACON 2026 (Americans for the Arts)', 'https://aftacon.org/', '2026-06-02', '2026-06-05', 'Albuquerque', 'NM', 'USA', 'in_person', '{arts}', true),
  ('Grantmakers in the Arts Conference 2026', 'https://www.gia-conference.org/', '2026-10-18', '2026-10-21', 'Memphis', 'TN', 'USA', 'in_person', '{arts}', true),

  -- ── Human services ──
  ('APHSA National Human Services Summit 2026', 'https://aphsa.org/national-summit/', '2026-06-14', '2026-06-17', 'Arlington', 'VA', 'USA', 'in_person', '{human_services}', true),
  ('Catholic Charities USA Applied Institute for Disaster Excellence 2026', 'https://www.catholiccharitiesusa.org/', '2026-03-16', '2026-03-20', 'Orlando', 'FL', 'USA', 'in_person', '{human_services,faith_based}', true),

  -- ── Faith-based ──
  ('Outcomes Conference 2026 (Christian Leadership Alliance)', 'https://christianleadershipalliance.org/outcomes-conference/', '2026-04-28', '2026-04-30', 'Dallas', 'TX', 'USA', 'in_person', '{faith_based}', true),

  -- ── Civil liberties / government accountability (wedge segment) ──
  ('FreedomFest 2026', 'https://freedomfest.com/', '2026-07-08', '2026-07-11', 'Las Vegas', 'NV', 'USA', 'in_person', '{civil_liberties}', true),
  ('SPN 34th Annual Meeting 2026', 'https://spn.org/spn-annual-meeting/', '2026-08-24', '2026-08-27', 'Orlando', 'FL', 'USA', 'in_person', '{civil_liberties}', true),
  ('Atlas Network Liberty Forum & Freedom Dinner 2026', 'https://www.atlasnetwork.org/events/liberty-forum-freedom-dinner', '2026-11-11', '2026-11-12', 'New York', 'NY', 'USA', 'in_person', '{civil_liberties}', true),
  ('LibertyCon International (Students For Liberty)', 'https://www.libertycon.com/', null, null, 'Washington', 'DC', 'USA', 'in_person', '{civil_liberties}', true)

on conflict on constraint events_dedupe_key do update set
  end_date         = excluded.end_date,
  location_city    = excluded.location_city,
  location_state   = excluded.location_state,
  location_country = excluded.location_country,
  format           = excluded.format,
  cause_area_tags  = excluded.cause_area_tags,
  is_seed          = true;
