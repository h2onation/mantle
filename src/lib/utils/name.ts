// First-name extraction. The DB's `profiles.display_name` may be a full
// "First Last" name (from OAuth signup, manual entry, etc.) but every
// place that *addresses* the user (PDF export header/title, group-chat
// salutations) should use just the first token. Single source of truth
// so we don't accumulate divergent split() calls.

export function firstNameFrom(name: string | null | undefined): string {
  if (!name) return "User";
  const trimmed = name.trim();
  if (!trimmed) return "User";
  const first = trimmed.split(/\s+/)[0];
  return first || "User";
}
