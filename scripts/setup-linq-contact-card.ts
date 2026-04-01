/**
 * One-time script to set the Linq contact card for the Sage phone number.
 * Makes the number show up as "Sage by Mantle" with a logo in iMessage.
 * Run: npx tsx scripts/setup-linq-contact-card.ts
 *
 * Only needs to run once per Linq phone number. Re-run if you change
 * the name or logo.
 */

import "dotenv/config";

const API_TOKEN = process.env.LINQ_API_TOKEN;
const PHONE_NUMBER = process.env.LINQ_PHONE_NUMBER;

if (!API_TOKEN) {
  console.error("Missing LINQ_API_TOKEN. Set it in .env.local.");
  process.exit(1);
}
if (!PHONE_NUMBER) {
  console.error("Missing LINQ_PHONE_NUMBER. Set it in .env.local.");
  process.exit(1);
}

// Using the existing app icon (512x512 square)
const IMAGE_URL = "https://trustthemantle.com/icons/icon-512.png";

async function main() {
  const res = await fetch(
    "https://api.linqapp.com/api/partner/v3/contact_card",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: PHONE_NUMBER,
        first_name: "Sage",
        last_name: "by Mantle",
        image_url: IMAGE_URL,
      }),
    }
  );

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("Failed to set contact card (%d):", res.status);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("Contact card set successfully!");
  console.log(JSON.stringify(body, null, 2));
  console.log("\nSage will show up as 'Sage by Mantle' in iMessage.");
}

main();
