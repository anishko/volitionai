// Shared validation/normalization for debrief writes. Both POST (create) and
// PATCH (update) accept the same optional fields; this turns a camelCase JSON
// body into the snake_case column update, rejecting bad values with a message.
// null is allowed everywhere (clears a field); undefined/absent keys are skipped.

const INT = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const NUM = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export interface NormalizedDebrief {
  update: Record<string, unknown>;
  error?: string;
}

/**
 * Reads the known debrief fields from `body` into a snake_case update object.
 * Only keys actually present on `body` are considered, so PATCH can send a
 * subset. Returns `{ error }` on the first invalid value.
 */
export function normalizeDebriefBody(body: Record<string, unknown>): NormalizedDebrief {
  const update: Record<string, unknown> = {};

  if ("worthIt" in body) {
    const v = body.worthIt;
    if (v === null) update.worth_it = null;
    else if (INT(v) && v >= 1 && v <= 5) update.worth_it = v;
    else return { update, error: "worthIt must be an integer 1-5 or null." };
  }

  if ("outcome" in body) {
    const v = body.outcome;
    if (v === null) update.outcome = null;
    else if (v === "attended" || v === "skipped") update.outcome = v;
    else return { update, error: "outcome must be 'attended', 'skipped', or null." };
  }

  if ("actualSpendUsd" in body) {
    const v = body.actualSpendUsd;
    if (v === null) update.actual_spend_usd = null;
    else if (NUM(v) && v >= 0) update.actual_spend_usd = v;
    else return { update, error: "actualSpendUsd must be a non-negative number or null." };
  }

  if ("leadsGained" in body) {
    const v = body.leadsGained;
    if (v === null) update.leads_gained = null;
    else if (INT(v) && v >= 0) update.leads_gained = v;
    else return { update, error: "leadsGained must be a non-negative integer or null." };
  }

  if ("contactsGained" in body) {
    const v = body.contactsGained;
    if (v === null) update.contacts_gained = null;
    else if (INT(v) && v >= 0) update.contacts_gained = v;
    else return { update, error: "contactsGained must be a non-negative integer or null." };
  }

  if ("notes" in body) {
    const v = body.notes;
    if (v === null) update.notes = null;
    else if (typeof v === "string") {
      const trimmed = v.trim();
      update.notes = trimmed.length > 0 ? trimmed : null;
    } else return { update, error: "notes must be a string or null." };
  }

  return { update };
}
