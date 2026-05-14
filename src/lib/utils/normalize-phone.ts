/**
 * Normalize a phone number to E.164 (+1XXXXXXXXXX) format.
 * Strips non-digit characters (except leading +), ensures +1 prefix for US numbers.
 *
 * @deprecated Prefer `normalizeUSToE164` from `@/lib/messaging/phone`, which
 * returns null on invalid input instead of `+1<garbage>`. This function
 * remains for backward compatibility with linq/group-detection call sites
 * that rely on the always-prefixed string for equality comparison; new code
 * should normalize-then-validate with the stricter helper.
 */
export function normalizePhone(raw: string): string {
  let phone = raw.replace(/[^\d+]/g, "");
  if (phone.startsWith("1") && !phone.startsWith("+")) {
    phone = "+" + phone;
  } else if (!phone.startsWith("+")) {
    phone = "+1" + phone;
  }
  return phone;
}
