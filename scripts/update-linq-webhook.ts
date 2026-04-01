/**
 * Update the existing Linq webhook subscription to add group chat events.
 * Run: npx tsx scripts/update-linq-webhook.ts
 *
 * Requires LINQ_API_TOKEN in .env.local (or set as env var).
 *
 * BEFORE RUNNING: You need the subscription ID from the original registration.
 * If you don't have it, list subscriptions first:
 *   curl -H "Authorization: Bearer $LINQ_API_TOKEN" \
 *        https://api.linqapp.com/api/partner/v3/webhook-subscriptions
 *
 * Then set LINQ_WEBHOOK_SUBSCRIPTION_ID below or pass as env var.
 */

import "dotenv/config";

const API_TOKEN = process.env.LINQ_API_TOKEN;
if (!API_TOKEN) {
  console.error("Missing LINQ_API_TOKEN. Set it in .env.local or as an env var.");
  process.exit(1);
}

const SUBSCRIPTION_ID = process.env.LINQ_WEBHOOK_SUBSCRIPTION_ID;
if (!SUBSCRIPTION_ID) {
  console.error(
    "Missing LINQ_WEBHOOK_SUBSCRIPTION_ID.\n" +
      "List existing subscriptions:\n" +
      '  curl -H "Authorization: Bearer $LINQ_API_TOKEN" \\\n' +
      "       https://api.linqapp.com/api/partner/v3/webhook-subscriptions\n" +
      "Then set LINQ_WEBHOOK_SUBSCRIPTION_ID in .env.local or as an env var."
  );
  process.exit(1);
}

async function main() {
  console.log("Updating webhook subscription %s...\n", SUBSCRIPTION_ID);

  const res = await fetch(
    `https://api.linqapp.com/api/partner/v3/webhook-subscriptions/${SUBSCRIPTION_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscribed_events: [
          "message.received",
          "message.failed",
          "message.delivered",
          "participant.added",
          "participant.removed",
          "chat.created",
        ],
      }),
    }
  );

  const body = await res.json();

  if (!res.ok) {
    console.error("Linq API error (%d):", res.status);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("Webhook subscription updated successfully!\n");
  console.log(JSON.stringify(body, null, 2));
  console.log("\n─────────────────────────────────────────");
  console.log("New subscribed events:");
  console.log("  message.received");
  console.log("  message.failed");
  console.log("  message.delivered");
  console.log("  participant.added   ← NEW");
  console.log("  participant.removed ← NEW");
  console.log("  chat.created        ← NEW");
  console.log("─────────────────────────────────────────");
}

main();
