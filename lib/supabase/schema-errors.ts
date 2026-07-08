// Detect PostgREST / Postgres errors for schema objects that are not applied yet.
// Used to degrade gracefully when the linked Supabase project is behind migrations.

function errorMessage(error: unknown): string {
  return typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

/** True when a table or column named in `names` is absent from the live schema. */
export function isMissingDbObject(error: unknown, names: string[]): boolean {
  const message = errorMessage(error);
  const code = errorCode(error);
  if (code === "PGRST204" || code === "42P01" || code === "42703") {
    return names.some((name) => message.includes(name));
  }
  return names.some(
    (name) =>
      message.includes(`'${name}'`) ||
      message.includes(`public.${name}`) ||
      message.includes(`relation "${name}" does not exist`) ||
      message.includes(`column ${name} does not exist`),
  );
}

export function isMissingMatchRunsTable(error: unknown): boolean {
  return isMissingDbObject(error, ["match_runs"]);
}

export function isMissingMatchTierColumn(error: unknown): boolean {
  return isMissingDbObject(error, ["match_tier"]);
}

export function isMissingIdentityKeyColumn(error: unknown): boolean {
  return isMissingDbObject(error, ["identity_key", "source_urls"]);
}
