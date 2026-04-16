// Selects the active messaging provider from env.
// Rollback: set MESSAGING_PROVIDER=linq in Vercel to revert the outbound path
// to Linq without a code change. Inbound always flows to both webhook endpoints;
// see decisions.md for the dual-provider architecture.

export type MessagingProvider = "linq" | "sendblue";

export function getActiveProvider(): MessagingProvider {
  const value = process.env.MESSAGING_PROVIDER;
  if (value === "linq" || value === "sendblue") return value;
  return "sendblue";
}
