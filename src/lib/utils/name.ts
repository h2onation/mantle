// First-name extraction. The DB's `profiles.display_name` may be a full
// "First Last" name (from OAuth signup, manual entry, etc.) but every
// place that *addresses* the user (PDF export header/title, group-chat
// salutations) should use just the first token. Single source of truth
// so we don't accumulate divergent split() calls.

export function firstNameFrom(name: string | null | undefined): string {
  return firstNameOrNull(name) ?? "User";
}

/**
 * Same first-name extraction as `firstNameFrom` but returns null when no
 * usable name is present. Use this where the absence of a name needs a
 * different code path (e.g., dropping the salutation entirely instead of
 * substituting "User"). Group-bridge and group-detection use this when
 * deciding whether to address the owner by name.
 */
export function firstNameOrNull(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}
