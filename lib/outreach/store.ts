// Persistence + row mapping for outreach_drafts (snake_case in the DB ↔
// camelCase OutreachDraft contract). Written server-side via the service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OutreachDraft,
  OutreachDraftType,
  OutreachModelRoute,
  SourcedClaim,
} from "@/types";

interface OutreachDraftRow {
  id: string;
  match_id: string;
  draft_type: OutreachDraftType;
  body: string;
  evidence: { claim?: unknown; source_url?: unknown }[];
  model_route: OutreachModelRoute;
  created_at: string;
}

export function rowToOutreachDraft(row: OutreachDraftRow): OutreachDraft {
  const evidence: SourcedClaim[] = (row.evidence ?? []).flatMap((e) => {
    const claim = typeof e.claim === "string" ? e.claim : "";
    const sourceUrl = typeof e.source_url === "string" ? e.source_url : "";
    return claim && sourceUrl ? [{ claim, sourceUrl }] : [];
  });
  return {
    id: row.id,
    matchId: row.match_id,
    draftType: row.draft_type,
    body: row.body,
    evidence,
    modelRoute: row.model_route,
    createdAt: row.created_at,
  };
}

/** Insert a generated draft. Best-effort: a persistence failure is logged and
 *  surfaced as null rather than losing the drafted body the caller already has. */
export async function persistOutreachDraft(
  admin: SupabaseClient,
  input: {
    matchId: string;
    draftType: OutreachDraftType;
    body: string;
    evidence: SourcedClaim[];
    modelRoute: OutreachModelRoute;
  },
): Promise<OutreachDraft | null> {
  try {
    const { data, error } = await admin
      .from("outreach_drafts")
      .insert({
        match_id: input.matchId,
        draft_type: input.draftType,
        body: input.body,
        evidence: input.evidence.map((e) => ({ claim: e.claim, source_url: e.sourceUrl })),
        model_route: input.modelRoute,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("no row returned");
    return rowToOutreachDraft(data as OutreachDraftRow);
  } catch (err) {
    console.error("[outreach] persist failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
