// E.164 validation and normalization for the messaging layer.
// Sendblue rejects non-E.164 numbers; we enforce strict E.164 at the client
// boundary before any outbound call hits the wire.

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

// Attempts to normalize common US formats to E.164.
// Returns null when confident normalization is not possible.
// Does not handle international numbers — that would need libphonenumber.
export function normalizeUSToE164(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("+") && isE164(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function assertE164(phone: string): void {
  if (!isE164(phone)) {
    throw new Error(`Phone number not in E.164 format: ${phone}`);
  }
}
