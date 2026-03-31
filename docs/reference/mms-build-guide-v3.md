# Sage MMS — Build Guide (v3)

> **ARCHIVED**: Twilio has been replaced by Linq as of 2026-03-31. The actual implementation lives in `src/lib/linq/` and `src/app/api/linq/`. This doc is kept for historical reference only.

## What Changed from v2
- Sage voice is identical to web app. No "shorter, casual" instruction. smsMode only strips checkpoint sections.
- Manual consent flow removed. If you linked your phone and have a manual, Sage uses it. Period.
- Removed over-engineered features: 24-hour session resets, SOLO keyword, message buffering, LEAVE command. These can be added later if needed.
- Group invite confirmation simplified to one step.

---

## Phase 0: Twilio Setup (YOU do this, not Claude Code)

### Step 1: Create Twilio account
1. twilio.com → sign up
2. ~$15 free trial credit
3. Verify your personal phone number when prompted

### Step 2: Buy a phone number
1. Console → Phone Numbers → Buy a Number
2. Filter: US, MMS capable
3. Buy one (~$1.15/month from trial credit)

### Step 3: Verify test phone numbers
**Do this before testing anything.** Trial accounts only send to verified numbers.
1. Console → Verified Caller IDs
2. Add your personal phone and any friend's phone you'll test groups with

### Step 4: Configure webhook
1. Phone Numbers → Active Numbers → click yours
2. Messaging → "A message comes in":
   - Webhook, `https://trustthemantle.com/api/sms/incoming`, HTTP POST
3. Save

### Step 5: Credentials and env vars
Copy Account SID and Auth Token from Console dashboard.

Add to `.env.local` AND Vercel (Settings → Environment Variables):
```
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### Step 6: Verify Vercel plan
Sage takes 5-8 seconds. Vercel free tier kills functions at 10 seconds. You need Vercel Pro ($20/month). Check before Phase 3.

### Verify Phase 0
- Twilio account with credit
- MMS-capable number purchased
- Test phones verified in Caller IDs
- Webhook pointed at your Vercel URL
- Env vars in .env.local AND Vercel
- Vercel Pro confirmed

---

## Phase 0.5: A2P Registration (start now, not blocking)

Console → Messaging → Trust Hub → Sole Proprietor. No EIN needed. Takes 1-2 weeks. Not needed for testing with verified numbers. Needed before beta users. Start it now so it's done when you need it.

---

## Phase 1: Echo Bot

### Claude Code Prompt
```
Install Twilio and create an echo bot to verify the plumbing.

npm install twilio

Create src/app/api/sms/incoming/route.ts (Node.js Runtime, NOT Edge):

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;
const client = twilio(accountSid, authToken);

export async function POST(request: NextRequest) {
  try {
    // Validate Twilio signature to prevent spoofed requests
    const twilioSignature = request.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://trustthemantle.com"}/api/sms/incoming`;
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value as string; });

    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);
    if (!isValid) {
      console.error("[sms] Invalid Twilio signature — rejecting request");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const from = params.From;
    const body = params.Body;

    console.log("[sms] Incoming from %s: %s", from, body);

    await client.messages.create({
      body: `Echo: ${body}`,
      from: twilioNumber,
      to: from,
    });

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("[sms] Error:", err);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}

IMPORTANT: Always return TwiML XML, even on error. Non-XML causes Twilio to retry.
IMPORTANT: Node.js Runtime only. No Edge.

Run npx tsc --noEmit after.
```

### Verify
1. Deploy to Vercel
2. Text your Twilio number
3. Receive "Echo: [your message]" within 10 seconds

### If it fails
- No response, no Twilio log entry: webhook URL wrong
- Twilio log shows "non-2xx": check Vercel function logs for missing env var
- Twilio shows "sent" but nothing received: phone not in Verified Caller IDs

---

## Phase 2: Phone Number Linking

### SQL (Supabase SQL Editor)
```sql
CREATE TABLE phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  verified boolean DEFAULT false,
  verification_code text,
  code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_phone" ON phone_numbers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_phone" ON phone_numbers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_phone" ON phone_numbers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_read_phones" ON phone_numbers
  FOR SELECT USING (is_admin());

CREATE INDEX idx_phone_lookup ON phone_numbers(phone) WHERE verified = true;
```

### Claude Code Prompt
```
Create phone number linking: one API route and a Settings UI.

FILE 1: src/app/api/settings/link-phone/route.ts (Node.js Runtime)

GET handler:
- Authenticate user
- Query phone_numbers for this user_id
- Return { phone: "+1...", verified: true } or { phone: null }

POST handler:
Body: { phone: string, code?: string }

No code (initiate):
- Authenticate user
- Normalize phone (strip spaces, ensure +1 prefix)
- Generate 6-digit code
- Upsert phone_numbers: { user_id, phone, verified: false, verification_code: code, code_expires_at: now + 10 min }
- Send via Twilio: "Your Mantle code: ${code}"
- Return { ok: true, status: "code_sent" }

Code present (verify):
- Check code matches and not expired
- Set verified = true, linked_at = now, clear code fields
- Return { ok: true, status: "verified", phone }

FILE 2: public/sage-contact.vcf
BEGIN:VCARD
VERSION:3.0
FN:Sage (Mantle)
TEL;TYPE=CELL:+1XXXXXXXXXX
END:VCARD
(Hardcode your actual Twilio number)

FILE 3: MobileSettings.tsx

Add "Text Sage" section above the admin section.

On mount: GET /api/settings/link-phone.

Not linked: "Link your phone to text Sage" → tap → phone input (tel type, +1 placeholder).
Verifying: phone input + 6-digit code input + Verify button.
Linked: show number + "Change" button + "Add Sage to contacts" link (downloads /sage-contact.vcf).

Same styling as existing settings rows.

Run npm run test && npx tsc --noEmit after.
```

### Verify
1. Settings → link your phone → receive code → verify
2. Supabase → phone_numbers → verified = true
3. "Add Sage to contacts" downloads .vcf

### If it fails
- Code not received: trial account, verify the number in Caller IDs
- VCF doesn't download: check file exists at public/sage-contact.vcf

---

## Phase 3: 1:1 Sage via MMS

### SQL (Supabase SQL Editor)
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel text DEFAULT 'web';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel text DEFAULT 'web';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS processing_sms boolean DEFAULT false;
```

No session table. No consent table. A message comes in, we identify the user, load their manual, run Sage, respond. The conversation is tracked in the existing conversations table with a channel flag.

### Claude Code Prompt
```
Rewrite the SMS webhook to run the full Sage pipeline.

Rewrite src/app/api/sms/incoming/route.ts:

FLOW:

1. PARSE: Extract From and Body from Twilio formData.
   Log: "[sms] Incoming from %s: %s"

2. IDENTIFY: Look up From in phone_numbers where verified = true using the admin client.
   - Not found → send "I don't recognize this number. Link your phone at trustthemantle.com" → return TwiML
   - Found → have user_id

3. LOAD MANUAL: Load manual_components for this user_id using admin client.
   - Empty → send "You don't have manual content yet. Build your manual at trustthemantle.com first." → return TwiML

4. FIND OR CREATE CONVERSATION: Look for an existing conversation for this user where channel = 'mms' and status = 'active', ordered by updated_at desc.
   - If none exists, create one: insert into conversations { user_id, status: 'active', channel: 'mms' } (you may need to add channel to the conversations table — if so, add ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel text DEFAULT 'web' to the migration above)
   - Use this conversation_id for all message storage

5. SAVE USER MESSAGE: Insert into messages { conversation_id, role: 'user', content: body, channel: 'mms', sender_phone: from }

6. LOCK: Before running Sage, check for concurrent requests. Use a simple approach: add a `processing_sms` boolean column on the conversations table (ALTER TABLE conversations ADD COLUMN IF NOT EXISTS processing_sms boolean DEFAULT false). Before running Sage:
   - Read the conversation's processing_sms value
   - If true: another request is already running Sage for this conversation. Skip processing, return empty TwiML. The first request will handle it.
   - If false: set processing_sms = true, proceed.
   - After Sage responds (or on error), always set processing_sms = false.
   - Use a try/finally to guarantee the lock is released.

   This prevents duplicate Sage responses when a user sends two messages in quick succession.

7. BUILD HISTORY: Load last 20 messages from this conversation_id ordered by created_at asc. Map to { role, content }.

8. RUN SAGE:
   - Call buildSystemPrompt with smsMode: true
   - Call anthropicFetch (not stream) with the system prompt + history
   - Extract response text

9. SAVE SAGE RESPONSE: Insert into messages { conversation_id, role: 'assistant', content: response, channel: 'mms' }

10. SEND: client.messages.create({ body: response, from: twilioNumber, to: senderPhone })
   Log: "[sms] Sage response (%d chars)"

11. RETURN empty TwiML.

Error handling:
- Pipeline fails → send "Something went wrong. Try again in a minute." → return TwiML
- Twilio send fails → log error → return TwiML
- Always return TwiML.

ALSO: Update system-prompt.ts

Add smsMode?: boolean to BuildPromptOptions.

When smsMode is true:
- Skip these sections: MANUAL ENTRY FORMAT, CHECKPOINTS, CHECKPOINT COMPOSITION VOICE, FIRST CHECKPOINT, POST-CHECKPOINT, BUILDING TOWARD SIGNAL, PATTERNS, PROGRESS SIGNALS, FIRST SESSION
- Keep everything else: VOICE, LEGAL, CONVERSATION APPROACH, DEEPENING MOVES, ADAPTING, SHORT ANSWERS
- Append one line at the end of the prompt: "You are responding via text message. No checkpoint formatting or manual entry blocks. If something comes up worth deeper exploration, say: 'This is worth exploring deeper. Open Mantle when you have 20 minutes.'"
- That's it. Same Sage. Same voice. Same depth. Just no checkpoints.

Do not duplicate the pipeline. Import buildSystemPrompt and call anthropicFetch directly. The webhook is a thin wrapper.

Run npm run test && npx tsc --noEmit after.
```

### Verify
1. Deploy
2. Text Sage from your linked phone
3. Sage responds within 10-15 seconds with a manual-aware response
4. Text a follow-up — Sage maintains context from the previous message
5. Supabase: messages table has rows with channel = 'mms', conversations table has a row with channel = 'mms'

### If it fails
- **No response at all:** Vercel function timeout. Check logs. Need Pro plan.
- **"I don't recognize this number":** Phone format mismatch. Twilio sends +1XXXXXXXXXX. Check phone_numbers table matches exactly.
- **Sage responds but ignores the manual:** Add logging in the handler to confirm manual_components is loaded and non-empty.
- **Duplicate responses:** Timeout + Twilio retry. Pro plan fixes this. Temporary fix: add a dedup check (if a message with the same content and sender_phone was saved in the last 30 seconds, skip processing).

---

## Phase 4: Group MMS

### BEFORE CODE: Manual Test

Test whether Twilio can send group MMS. In your terminal:
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "From=$TWILIO_PHONE_NUMBER" \
  -d "To=+1YOURNUMBER" \
  -d "To=+1FRIENDSNUMBER" \
  -d "Body=Group test from Sage"
```

Check both phones. Three possible outcomes:
- **Native group thread forms:** Both phones show the same group thread. Proceed with native groups.
- **Individual messages:** Each phone gets a separate message from Sage's number. Groups are simulated — each person sees messages relayed with name prefixes.
- **Twilio rejects the request:** Multiple To values not supported. Use Twilio Messaging Service or Conversations API instead.

**Tell me what happened before running the Claude Code prompt.** The prompt changes depending on the outcome.

### SQL (Supabase SQL Editor, after test passes)
```sql
CREATE TABLE mms_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inviter_phone text NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);

CREATE TABLE mms_thread_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES mms_threads(id) ON DELETE CASCADE,
  phone text NOT NULL,
  user_id uuid REFERENCES profiles(id),
  manual_consent boolean DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mms_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mms_thread_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_threads" ON mms_threads FOR SELECT USING (is_admin());
CREATE POLICY "admin_read_members" ON mms_thread_members FOR SELECT USING (is_admin());
CREATE INDEX idx_thread_members_phone ON mms_thread_members(phone);
```

### Claude Code Prompt (will depend on test results — ask me after testing)

The prompt will cover:
- Detecting "invite +1XXXXXXXXXX" in the 1:1 handler
- Creating the group thread
- Sending to all participants (native or simulated depending on test)
- Routing incoming group messages to the right thread
- Sage's group behavior (respond when relevant, stay quiet otherwise)
- Loading the inviter's manual for group context

### Verify
1. Text Sage: "invite +1[friend's number]"
2. Friend receives intro message
3. Friend texts something → Sage responds or stays quiet
4. You text → friend sees it (native) or receives it via Sage (simulated)

---

## Phase 5: Web App Integration

### Claude Code Prompt
```
Make MMS conversations visible in the web app session drawer.

CHANGE 1: The conversations table now has a channel column. Update the conversations list query to include channel in the response.

CHANGE 2: In SessionDrawer.tsx, for conversations where channel === 'mms', show a small "TEXT" label (mono 7px, var(--color-text-ghost)) next to the date.

CHANGE 3: When a user taps an MMS conversation, show messages read-only. Hide ChatInput. Show a note at the bottom: "This conversation continues via text message."

Run npm run test && npx tsc --noEmit after.
```

### Verify
1. Have a few MMS exchanges with Sage
2. Open web app → session drawer → MMS conversation appears with "TEXT" label
3. Tap it → read-only, no input

---

## Phase 6: CLAUDE.md

### Claude Code Prompt
```
Update CLAUDE.md:

API Routes:
| POST | /api/sms/incoming | Node | Twilio webhook: identifies user, loads manual, runs Sage, responds via MMS |
| GET/POST | /api/settings/link-phone | Node | Phone number verification flow |

Database:
phone_numbers — phone to user mapping, verified via SMS code
messages.channel — "web" or "mms"
messages.sender_phone — nullable, for MMS messages
mms_threads — group thread metadata
mms_thread_members — group membership
conversations.channel — "web" or "mms"

Architecture:
MMS integration uses Twilio. Users link phone in Settings, text Sage. Same pipeline, smsMode flag strips checkpoint sections. No manual building via MMS. Group threads load inviter's manual. SMS conversations create conversations rows and appear in web app session drawer.

Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

Commit.
```

---

## Risk Summary

| Phase | Risk | Severity | Mitigation |
|-------|------|----------|------------|
| 1 | Webhook URL wrong | Low | Check Twilio logs |
| 1 | Phone not in Verified Caller IDs | Low | Verify before testing |
| 3 | **Vercel function timeout** | **High** | **Requires Vercel Pro ($20/mo)** |
| 3 | Phone format mismatch | Medium | Normalize to +1XXXXXXXXXX. Log raw From. |
| 3 | Duplicate responses from Twilio retry | Medium | Pro plan fixes timeout. Add dedup check as safety net. |
| 4 | **Group MMS doesn't form native thread** | **High** | **Manual test first. Fallback: simulated groups.** |
| 4 | Thread routing (1:1 vs group) | Medium | Check mms_thread_members first. Default to group if active. |
| All | A2P registration not approved | Low | Start early. Testing uses verified numbers. |

## What's Intentionally Deferred
- Manual consent per session (just load it)
- Message buffering for multi-message bursts (handle later if needed)
- SOLO/LEAVE keywords (add if users request it)
- 24-hour session resets (add if conversation context gets stale)
- Voice note transcription (users can dictate via keyboard)
- Invited person's manual consent in groups (future, with privacy controls)
- Privacy filtering of manual content in groups (future)
