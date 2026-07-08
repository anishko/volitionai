-- Follow-up migration for PRD v4 (advisor input #3: conversational onboarding).
-- Additive only — earlier migrations are already applied, so this ALTERs.
-- See docs/NONPROFIT_EVENTS_PRD.md → "Conversational onboarding".

-- The model's short, free-text summary of sentiment / context / constraints
-- the org expressed in conversation that the structured fields don't capture
-- (e.g. "board-scrutinized budget; skeptical of generic nonprofit conferences;
-- documentary screening tied to a legislative session"). Used later to add
-- flavor/grounding to match explanations — NOT a citable field. Nullable;
-- populated by the conversational intake, empty for the form fallback.
alter table public.nonprofit_profiles
  add column if not exists qualitative_signals text;
