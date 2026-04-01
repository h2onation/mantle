/**
 * Normalize a phone number to E.164 (+1XXXXXXXXXX) format.
 * Strips non-digit characters (except leading +), ensures +1 prefix for US numbers.
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
