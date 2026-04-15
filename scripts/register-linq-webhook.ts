/**
 * One-time script to register a Linq webhook subscription.
 * Run: npx tsx scripts/register-linq-webhook.ts
 *
 * Requires LINQ_API_TOKEN in .env.local (or set as env var).
 * Prints the signing_secret — save it as LINQ_WEBHOOK_SECRET in .env.local.
 */

import "dotenv/config";

const API_TOKEN = process.env.LINQ_API_TOKEN;
if (!API_TOKEN) {
  console.error("Missing LINQ_API_TOKEN. Set it in .env.local or as an env var.");
  process.exit(1);
}

const TARGET_URL =
  "https://mywalnut.app/api/linq/webhook?version=2026-02-03";

async function main() {
  const res = await fetch(
    "https://api.linqapp.com/api/partner/v3/webhook-subscriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_url: TARGET_URL,
        subscribed_events: [
          "message.received",
          "message.failed",
          "message.delivered",
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

  console.log("Webhook subscription created successfully!\n");
  console.log(JSON.stringify(body, null, 2));
  console.log("\nAdd the signing field from the response above to your .env.local file.");
}

main();
