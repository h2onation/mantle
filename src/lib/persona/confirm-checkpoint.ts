import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME, COMPOSITION_MODEL } from "./config";
import { deriveSummaryFromContent } from "./manual-context";

// ─── Manual entry composition (Opus) ───────────────────────────────────────

interface ComposeManualEntryOptions {
  checkpointText: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  languageBank: { phrase: string; context: string; charge: string }[];
  /** The user's full Manual so far. Opus uses this for two things: layer
   *  assignment (which of the 5 layers does this entry belong to, given
   *  what's already there) and integration (deepen or contrast existing
   *  entries on the chosen layer). Replaces the old `layer` + `name` +
   *  `existingLayerContent` inputs — the classifier no longer pre-picks
   *  these. */
  manualComponents: { layer: number; name: string | null; content: string }[];
  /** distinct_contexts from the latest extraction state. When 1 or 0 the
   *  entry came from a single situation, so the headline validator will
   *  enforce a "can" / "sometimes" softener — prevents over-claiming a
   *  recurring pattern from one data point. null / undefined means
   *  "unknown" (e.g. legacy extraction state without this field); the
   *  softener check is then skipped to preserve prior behavior. */
  distinctContexts?: number | null;
  /** The session's accumulated understanding, carried from the latest
   *  extraction state. The composer only sees the last 8 messages, so
   *  without these it writes the entry blind to the depth the whole
   *  session built — which is the mechanical reason entries read as
   *  recap. depth is the deepest rung reached (surface → behavior →
   *  feeling → mechanism → origin); sageBrief is the running read of
   *  what's underneath; currentThread is what's live right now. All
   *  optional / nullable so legacy callers and thin states degrade
   *  gracefully. */
  depth?: string | null;
  sageBrief?: string | null;
  currentThread?: string | null;
}

/**
 * Calls Opus (COMPOSITION_MODEL) to compose a polished manual entry from a checkpoint reflection.
 * Invoked server-side after the deterministic transition-line detection.
 * Opus picks the layer, picks the headline, polishes the prose, and emits
 * the compressed summary + key_words used to shrink older entries when
 * they're shown back to Jove in future sessions.
 *
 * Returns null on failure or if Opus can't pick a valid layer — caller
 * should fall back gracefully (no checkpoint surfaced).
 */
export async function composeManualEntry(
  options: ComposeManualEntryOptions
): Promise<{
  content: string;
  name: string;
  layer: number;
  changelog: string;
  summary: string;
  key_words: string[];
  /** Specific reflective bubble rendered as a regular Jove chat message
   *  immediately before the trigger card. Quotes a phrase or moment from
   *  the user's last 1-2 turns, then signals the intent to mark this.
   *  Replaces the old generic "A pattern came through in what you said"
   *  lead-in and the transient "Something is forming…" loading label.
   *  May be empty when Opus declines to produce a usable line — caller
   *  should skip emission in that case. */
  acknowledgment: string;
} | null> {
  const {
    checkpointText,
    conversationHistory,
    languageBank,
    manualComponents,
    distinctContexts,
    depth,
    sageBrief,
    currentThread,
  } = options;

  const chargedLanguage = languageBank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-10);

  const languageSection =
    chargedLanguage.length > 0
      ? `\nUSER'S OWN LANGUAGE (use these exact phrases where they carry weight):\n${chargedLanguage.map((e) => `"${e.phrase}" — re: ${e.context}`).join("\n")}\n`
      : "";

  // Render the full Manual grouped by layer so Opus can both PICK the
  // right layer for the new entry and integrate with existing entries on
  // that layer. Empty layers are still listed (so Opus knows the option
  // exists) but show "(no entries yet)".
  const layerCatalog = LAYERS.map((l) => {
    const entries = manualComponents.filter((c) => c.layer === l.id);
    const entriesText =
      entries.length === 0
        ? "(no entries yet)"
        : entries
            .map(
              (c) => `  [entry${c.name ? ` — "${c.name}"` : ""}]\n  ${c.content}`
            )
            .join("\n\n");
    return `Layer ${l.id} — ${l.name} (${l.dimensions.join(", ")}):\n${entriesText}`;
  }).join("\n\n");

  const manualSection = `\nTHE USER'S MANUAL SO FAR:\n${layerCatalog}\n\nPick the layer this entry belongs to based on what the entry IS (the dimensions above), and how it relates to entries already on that layer. Integrate with or deepen existing entries when relevant. If new material contradicts an existing entry on the chosen layer, name the tension. When a prior entry genuinely connects to this one, you may draw the connection in the user's own voice — something they can recognize showing up across situations. But the spine of THIS entry stays the pattern from THIS conversation. Do not make a previous entry's frame the backbone of the new one just because the user is returning.\n`;

  // Last 8 messages for context
  const recentHistory = conversationHistory.slice(-8);
  const historyText = recentHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  // The session's accumulated understanding. The recent-history window
  // above only spans 8 messages; an entry composed from that alone reads
  // as a recap of the last few turns. These lines carry forward the depth
  // the whole conversation reached so the entry can name what the user
  // couldn't see from inside, not just replay what they just said.
  const depthBrief = [
    depth ? `- Depth this conversation reached: ${depth}` : null,
    sageBrief ? `- What's underneath it: ${sageBrief}` : null,
    currentThread ? `- The live thread: ${currentThread}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const depthSection = depthBrief
    ? `\nWHERE THIS CONVERSATION GOT TO (compose from this understanding, not just the recent messages above):\n${depthBrief}\n`
    : "";

  const system = `You compose manual entries for a self-authored Manual. You receive a checkpoint reflection from a conversationalist called ${PERSONA_NAME} and the recent conversation. Your job is to distill this into a structured entry that reads as the user describing themselves to themselves.

THE ENTRY (field: "content")
Statement + passage as continuous prose. The statement is the first sentence: one line, first person, the truest description of the pattern. Hard cap around 20 words. Below that the rhythm carries it.

The passage follows immediately. 80+ words. It makes these moves in any order:
- Specificity in the first half. A concrete situation the user described, not an abstract claim.
- A reframe somewhere. The pattern is not what it looks like on the surface. Name what it actually is.
- Conditions or texture. When it fires hardest. What makes it different from the surface read. The user's own noticing.
- What changes now. If the conversation produced a clear stance ("I need people to X" or "I'm going to stop doing Y"), land it in the passage. If the user sees the pattern but hasn't landed on a stance, use their own words about where they are. If they said nothing about stance, omit. Do not fabricate a takeaway. This is not advice or a treatment plan. It flows naturally in the prose, not as a separate section.

STUDY THESE EXEMPLARS FIRST. They are the bar. Imitate this depth before you worry about the rules below. The rules tell you what to avoid. These show you what to reach for.

The single most important move: GO ONE LEVEL DEEPER. A recap replays what the user already said in better words. A real entry names the part they couldn't see from inside. If they could have written the sentence themselves before this conversation, it's a recap. Go past it.
  Recap: "You avoid hard conversations because they stress you out."
  Deeper: "I don't avoid the conversation. I avoid the second I'd have to watch it land wrong on someone. The talking was never the hard part. The hard part is the face changing across from me."

Friction example.
  Recap: "When my manager checks in, my chest gets tight. My mind goes blank even though I know the answer."
  Right: "Half my system answers. The other half monitors how the answer will land. The monitoring half is louder, so it wins the resources. I hesitate. The hesitation looks like uncertainty, which invites more checking in, which fires the monitoring harder. I can't stop monitoring because the one time I didn't manage the impression, it cost me. But the monitoring itself is what makes me look unsure."

Strength example. Strengths get the SAME care and the same depth. Name the capability and the conditions that bring it out. Do not bend it into a hidden cost or a downside the user never raised. A strength is allowed to just be a strength.
  Recap: "I'm good at focusing on a problem for a long time."
  Right: "When a problem has a real edge to it, I drop in and the rest of the room goes quiet. Hours pass and I don't clock them. It isn't discipline. It's that the problem is more interesting than anything else competing for me. The same depth that makes me lose track of time is what lets me find the thing everyone else walked past."

Stay in the user's frame. The entry's subject is the thing THEY named as the problem, in their words, not a more interesting angle you found. If they came in about one thing and you write the entry about a different thing, you have substituted your read for theirs. Keep their driver as the spine. A nearby thread can appear, but it does not take over the entry. Pitch the entry at the altitude of the pattern they named, not a narrow single moment of it.
  Substituted frame (wrong): "I leave the room instead of asking him to turn the music down. I manage the discomfort alone rather than risk his reaction." (The user led with a sensory need. The sound drains them, they want quiet. This makes the entry about conflict-avoidance, a thread they did not lead with.)
  User's frame (right): "When I'm already tired, the sound takes over my space and I can't get to quiet. It drains me before I can name it. There is a real fear that asking will set him off, so I end up holding the load myself. But the thing I actually need is simple. Quiet I get to choose." (The sensory need stays the spine. The relational fear is present but does not replace it.)

VOICE RULES:
- First person. The user is the author. "I" not "You."
- No phrase a person wouldn't use about themselves out loud, to someone they trust, on a normal day. Read every sentence back and ask: would a person actually say this about themselves? "I turn away before the reach" — no. "I turn away before they can ask me" — yes. Plain spoken language. No nominalizations ("the reach," "the ask," "the pull"). Use verbs, not nouns pretending to be verbs.
- No session references ("I told ${PERSONA_NAME}," "we talked about," "in this conversation"). The entry reads the same six months from now.
- Use the user's exact charged phrases verbatim. Their sensory and system words carry into the entry without translation. Freeze-register examples: "buzzing," "too loud," "shut down," "went offline," "full," "tight," "crashed," "too close," "heavy." Activation-register examples: "racing," "surging," "hot," "prickle," "lit up," "pounding," "electric." Do not upgrade their vocabulary.
- Grounded in their specific examples and moments. Not abstract.
- Stay within the scope of evidence the user gave you. If they described one example (one person, one situation, one moment), anchor the entry IN that example — name the person, name the context. Do not generalize to "everyone," "every time," "all conversations." Do not use "always," "every," "all," "never" unless the user used those exact words themselves. One example produces a specific claim, not a universal one. Two or three convergent examples can support a wider claim — but only as wide as the examples actually span.
- AVOID UNIVERSAL TONE THROUGHOUT, not just the explicit "always/every/all/never" words. Phrases like "every low-stakes moment," "every friendship," "in those rooms," "whenever this happens," "any time someone X" read as universal claims even without the exact word. Watch for them. Use qualified framing instead: "sometimes," "often," "I notice," "there are moments when," "I can find myself," "when this happens." The body describes a pattern the user has noticed in their own behavior, not a defining trait that's true 100% of the time.
  Bad → good rewrites:
  • "I disappear when nobody needs me." → "Sometimes when nobody needs something from me, I notice I drift out."
  • "Every friendship that just wants me without a job to do." → "Friendships that just want me without a job can leave me restless."
  • "In those rooms I'm scanning." → "In moments like that, I notice I'm scanning."
  • "It costs me every low-stakes moment." → "It can cost me the low-stakes moments."
- Concrete anchor REQUIRED in the passage: a body sensation OR a specific behavioral or system response (what they did, what their system did, what the input was like). If the user gave a body sensation anywhere in the conversation, prefer it and make it appear. If they did not, a concrete behavioral anchor carries the same evidentiary weight. The anchor is the evidence the mechanism is real.
- NOT A RECAP. Go one level deeper than what was said. The user should read the entry and think "I knew most of this but I couldn't see THAT part." Never summarize the conversation.
- No clinical framework names. No "schema," "attachment style," "dysregulation," "sensory processing disorder," "executive dysfunction," "rejection sensitive dysphoria," "avoidance," "trauma response." Describe the behavior and the body instead. "I shut down" not "I dissociate." "A second version of me switches on" not "I mask." "The room got too loud" not "sensory overwhelm."
- No time references. No "right now," "currently," "at this stage," "these days." The entry describes how I operate, period.
- BIND REQUIRED in the passage. What the pattern protects AND what it costs. Both.
- Do not use dashes or hyphens to join clauses. Use periods.
- Write like a field note, not literature. Flat, honest, direct. If a sentence sounds like it belongs in a poem or an essay, rewrite it plain.

HEADLINE (field: "name"):
4-8 words. Flatly descriptive. Plain first-person subject-verb. No poetry, no imagery, no literary flair. The subject of the headline should be "I" — NOT a body part as agent.

ALTITUDE FIRST: name the PATTERN the user is actually describing, not a narrow single conclusion. If the user named a broad, recurring way they operate (it shows up across situations, not just the one scene in front of you), the headline names THAT, in their words, even if it is wider than one trigger. Do not shrink a broad pattern down to one of its instances just to make the title concrete. Test: would the user say "yes, that's the thing that runs me" (right altitude), or "yes, that happened once" (too narrow, you captured an instance not the pattern)?

REQUIRED: name a SPECIFIC TRIGGER or CONDITION. Format: "I [verb] when [specific trigger]" or "I [verb] before [specific event]" or "I [verb] after [specific moment]." The trigger names a concrete situation — a person, a moment, a sensation. Not "before I can say it" (vague — what stops me?) but "when guilt hits" or "when someone waits for me to answer" (specific). Not "in real life" (too broad) but "outside the dungeon" or "when there's no contract" (specific). The title should answer "WHEN does this fire?" not just "WHAT happens?" But when the pattern the user named is broad and recurring, keep the condition light ("when the verdict isn't in," "in quiet moments with no task") rather than narrowing the whole pattern to a single instance. Altitude beats trigger-specificity when the two conflict.

DO NOT personify the trigger as an actor doing something to you. "When small talk drains," "when the room scans," "when the gap fires," "while the conversation pulls" — these are imagery, not literal situations. Use the event instead: "at low-stakes dinners," "in surface conversations," "when the talk stays small."

REQUIRED: the verb must describe an OBSERVABLE BEHAVIOR — what a friend watching the scene would see you do. Abstract / internal / metaphorical verbs are not allowed because they describe a felt state, not an action. Forbidden verbs include: "disappear," "vanish," "lose myself," "fade," "go missing," "come undone," "fall apart," "shut down inside," "break open," "dissolve." If the user described feeling like they "disappear," translate that into the observable behavior — what do they actually DO in the moment? Steer the conversation? Get quiet? Scan for problems? Build a topic? Use that verb instead. EXCEPTION — the user's own words win: if one of these forbidden verbs is the user's OWN exact phrase (they literally said "I lose myself" or "I disappear"), use their phrase. Their truest self-description outranks this list. The ban is only for felt-state verbs the user did not say — it stops you from inventing poetic vagueness, not from quoting the user.

SECONDARY VERB RULE: prefer the flattest literal verb over embodied / postural metaphors that LOOK observable but stand in for a semantic claim. "Stay seated," "tighten," "swallow," "brace," "lean in," "stiffen" — a friend could see these, but each one does metaphorical work where a plainer verb would carry the same meaning. Prefer "stay at," "keep going to," "sit through," "wait," "go quiet," "leave," "say," "agree," "ask." If swapping the embodied metaphor for the literal verb preserves the meaning, swap it. The headline reads like a field note, not a tagline.

If the user gave only ONE example, soften the title with "can" or "sometimes" so it does not over-claim from one data point. "I can freeze when asked what I want" beats "I freeze when asked what I want" if only one freezing moment was described. With two or three convergent examples, drop the hedge.

Good: "I Can Freeze When Asked What I Want," "I Go Quiet When Someone Waits," "I Keep Teaching Him How to Live," "I Steer Toward Problems When Friends Just Want to Chat," "I Get Restless When the Room Has No Job for Me," "I Keep Going to Dinners That Drain Me," "I Stay at Conversations That Stay Surface," "I Say Yes to Plans I Want to Skip," "I Wait to Answer When Someone Watches"
Bad:
- Abstract / internal verbs ("I Disappear When Nobody Needs Carrying," "I Vanish in Easy Rooms," "I Lose Myself When the Room Is Quiet"). Disappear / vanish / lose myself are felt states, not actions.
- Postural / embodied metaphors masquerading as observable ("I Stay Seated While Small Talk Drains" — "stay seated" stands in for "endure"; "small talk drains" personifies the trigger. Plain rewrite: "I Keep Going to Dinners That Drain Me"). Same pattern: "I Tighten Before Hard Questions" → "I Go Quiet Before Hard Questions." "I Swallow the Answer When Guilt Hits" → "I Hold Back When Guilt Hits."
- Definitive without trigger ("I Swallow the Answer Before I Can Say It" — what triggers it?; "I Spit the Signal Back Before Anyone Hears It").
- Body-part-as-agent ("Stomach Pushes Me to Fix the Call," "Voice Goes When Pressure Lands").
- Clinical labels ("The Masking Loop," "Sensory Overwhelm Pattern").
- Nominalizations ("Turned Away Before the Ask").
- Metaphors and poetic titles ("Gaps Open and the Reach Fires").
If the verb is observable but doing metaphorical work, check whether a plainer verb carries the same meaning — if so, use that.

LAYER (field: "layer", required):
An integer 1-5 indicating which of the Manual's five layers this entry belongs to. Pick the layer whose dimensions (shown alongside each layer in the input) best describe what the entry IS. If existing entries on a layer already touch the same territory, prefer that layer so the entry integrates rather than scattering.

ACKNOWLEDGMENT (field: "acknowledgment", required):
A single sentence rendered as a chat bubble RIGHT BEFORE the trigger card. It's how Jove signals "I heard you" before handing the user a structured artifact. Without this beat, the card lands cold — the user gets processed instead of met.

Rules:
- 12-22 words. One sentence.
- Second-person. "you" not "I."
- Quote or name a SPECIFIC moment, image, or phrase from the user's last 1-2 turns. Not a generic feeling word — the actual concrete thing. "The bit where you said you can't stop monitoring" is specific. "What you just shared about your anxiety" is generic — bad.
- End with the contractual signal in plain language: "I want to mark this," "I want to put this down," "this is the part I want to capture," or a close variant. This is how the user knows the upcoming card is a Manual entry, not just a reflection.
- Plain spoken. No clinical labels. No therapy voice ("I'm hearing that..."). No "thank you for sharing." Sounds like a friend who was actually listening.

Good:
- "That last bit. Finding yourself at the monstera, no memory of starting. I want to mark that."
- "The thing you said about your stomach knowing before your head does, I want to put that down."
- "What you said about the door locking you in with the danger, not out from it. That's worth capturing."

Bad:
- "I hear how hard this is for you. Let me put this in your Manual." (therapy voice, generic)
- "Thank you for sharing that. I want to capture this." (transactional, not specific)
- "A pattern came through in what you said." (generic, no specifics)
- "That sounds really painful." (sympathetic but doesn't name anything specific)

If the user's last turns don't have a quotable specific moment, return an empty string and the caller will skip emission. Better silence than a generic acknowledgment.

COMPRESSED REPRESENTATION (for future reference):
- summary: one sentence, 20-40 words, third-person. Mechanism and bind briefly. User's charged words preserved. If a clear stance emerged, mention it.
- key_words: 3-6 short words or bigrams the user would use to recognize this entry. Include charged sensory/system words they used. Do not include clinical terms.

Respond with ONLY valid JSON. No markdown. No backticks.
{"content": "Statement + passage...", "name": "Headline", "layer": 1, "acknowledgment": "Specific reflective sentence ending with intent to mark.", "changelog": "One sentence.", "summary": "Third-person summary.", "key_words": ["word1", "word2"]}`;

  const userContent = `${languageSection}${manualSection}${depthSection}
RECENT CONVERSATION:
${historyText}

${PERSONA_NAME.toUpperCase()}'S CHECKPOINT REFLECTION:
${checkpointText}

Compose the manual entry. Pick the layer, the headline, the prose. Return the JSON.`;

  const response = await anthropicFetch({
    model: COMPOSITION_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const cleaned = extractResponseText(response)
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.content || typeof parsed.content !== "string") {
    return null;
  }

  // Layer must be a valid integer in 1..5. If Opus emits anything else the
  // entry can't be filed correctly — return null so the caller suppresses
  // the checkpoint rather than scattering an entry to an unknown layer.
  const rawLayer = parsed.layer;
  const parsedLayer =
    typeof rawLayer === "number"
      ? rawLayer
      : typeof rawLayer === "string"
        ? Number.parseInt(rawLayer, 10)
        : NaN;
  if (
    !Number.isInteger(parsedLayer) ||
    parsedLayer < 1 ||
    parsedLayer > 5
  ) {
    console.error(
      "[composeManualEntry] Composition returned invalid layer:",
      rawLayer
    );
    return null;
  }
  const layer: number = parsedLayer;

  // Universal-tone validator. The composition prompt forbids "always /
  // every / all / never / everyone / nobody" unless the user used the
  // word first (see "AVOID UNIVERSAL TONE THROUGHOUT" in the prompt
  // above). Dev-simulator audit (2026-05-19) caught "I'm always tracking
  // how things land" landing in an entry when the user had never said
  // "always" — the prompt is regularly skipped, so add a log-only check
  // so we can see the rate. Doesn't block the entry (matches the soft-
  // warning pattern around the headline retry above).
  const universalViolations = findUniversalToneViolations(
    parsed.content,
    conversationHistory
  );
  if (universalViolations.length > 0) {
    console.warn(
      "[composeManualEntry] Entry contains universal-tone words not used by user: %s",
      universalViolations.join(", ")
    );
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : deriveSummaryFromContent(parsed.content);

  const keyWords = Array.isArray(parsed.key_words)
    ? parsed.key_words
        .filter((w: unknown): w is string => typeof w === "string")
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
    : [];

  // Acknowledgment: trimmed string. Length and shape are governed by the
  // composer prompt ("12-22 words. One sentence."). Empty string flows
  // through naturally — the caller skips emission when falsy.
  const acknowledgment =
    typeof parsed.acknowledgment === "string"
      ? parsed.acknowledgment.trim()
      : "";

  // Headline validation + retry-once. The main composer juggles layer
  // pick, prose polish, summary, key_words, acknowledgment, AND the
  // headline. Quality on the headline suffers — "Worst-Case Loop Fills
  // the Processing" passed through despite the composition prompt
  // explicitly forbidding nominalization-as-agent. The validator below
  // catches the structural failures (subject not "I", abstract verb,
  // no trigger word, missing softener for single-example); on failure
  // we call a focused headline composer once with a tight prompt that
  // does nothing but write the headline. Use the better of the two
  // attempts (lower violation count). Never block the entry — if both
  // attempts fail, ship the original and log for tuning visibility.
  const isSingleExample =
    typeof distinctContexts === "number" && distinctContexts <= 1;
  const initialName = parsed.name || "Untitled";
  // The user's own words. Lets the headline validator honor a "felt-state"
  // verb (lose myself, fade, etc.) when it is the user's exact phrase, so
  // the title can name the pattern in their language instead of being
  // forced to a narrower observable proxy.
  const userMessageText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  let finalName = initialName;
  const headlineCheck = validateHeadline(initialName, isSingleExample, userMessageText);
  if (!headlineCheck.ok) {
    console.warn(
      "[composeManualEntry] Headline failed validation: %s — retrying once",
      headlineCheck.reasons.join("; ")
    );
    const retry = await composeHeadline(
      parsed.content,
      isSingleExample,
      initialName,
      headlineCheck.reasons
    );
    if (retry) {
      const retryCheck = validateHeadline(retry, isSingleExample, userMessageText);
      if (retryCheck.reasons.length < headlineCheck.reasons.length) {
        finalName = retry;
        if (!retryCheck.ok) {
          console.warn(
            "[composeManualEntry] Retry better but still imperfect: %s",
            retryCheck.reasons.join("; ")
          );
        }
      } else {
        console.warn(
          "[composeManualEntry] Retry no better (%d reasons vs %d): keeping original",
          retryCheck.reasons.length,
          headlineCheck.reasons.length
        );
      }
    }
  }

  return {
    content: parsed.content,
    name: finalName,
    layer,
    changelog: parsed.changelog || `Created ${LAYER_NAMES[layer] || "Layer " + layer} entry.`,
    summary,
    key_words: keyWords,
    acknowledgment,
  };
}

// ─── Universal-tone validator ──────────────────────────────────────────────

const UNIVERSAL_TONE_WORDS = [
  "always",
  "every",
  "all",
  "never",
  "everyone",
  "nobody",
] as const;

/**
 * Find universal-tone words that appear in the composed entry content but
 * NOT in the user's own messages. The composition prompt forbids these
 * unless the user used the word first; this catches the violations the
 * prompt fails to prevent (see the "AVOID UNIVERSAL TONE THROUGHOUT"
 * block in the composition system prompt above).
 *
 * Returns the list of violating words. Empty list means clean.
 * Caller logs; doesn't block — soft warning, same shape as headline retry.
 */
function findUniversalToneViolations(
  content: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): string[] {
  const userText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const violations: string[] = [];
  for (const word of UNIVERSAL_TONE_WORDS) {
    const wordRegex = new RegExp(`\\b${word}\\b`, "i");
    if (wordRegex.test(content) && !wordRegex.test(userText)) {
      violations.push(word);
    }
  }
  return violations;
}

// ─── Headline validator + focused retry composer ───────────────────────────

/**
 * Structural validator for composed headlines. Catches the failures the
 * main composition prompt is supposed to prevent but routinely lets
 * through — non-"I" subject, internal/abstract verbs, missing trigger
 * word, missing "can"/"sometimes" softener when the entry came from a
 * single example. Returns `{ok, reasons}` so the caller can decide
 * whether to retry. Word-count check is lenient (4-10) rather than the
 * prompt's stated 4-8 because the composition prompt's own "good"
 * exemplars include headlines up to 11 words — the other axes are the
 * load-bearing ones.
 */
export function validateHeadline(
  headline: string,
  isSingleExample: boolean,
  userText: string = ""
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const trimmed = headline.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length < 4 || words.length > 10) {
    reasons.push(`word count ${words.length} (need 4-10)`);
  }

  // Subject test: first word must be "I". Catches body-part-as-agent
  // ("Stomach Pushes Me to Fix the Call") and nominalization-as-agent
  // ("Worst-Case Loop Fills the Processing") in one shot.
  if (!/^I\b/.test(trimmed)) {
    reasons.push("subject is not 'I'");
  }

  // Banned internal/abstract verbs from confirm-checkpoint composition
  // prompt. These describe a felt state, not an observable action.
  const BANNED_VERBS: RegExp[] = [
    /\bdisappear/i,
    /\bvanish/i,
    /\bfade/i,
    /\bdissolve/i,
    /\bfall apart\b/i,
    /\bcome undone\b/i,
    /\bgo missing\b/i,
    /\blose myself\b/i,
    /\bbreak open\b/i,
    /\bshut down inside\b/i,
  ];
  // Mirror-exact-language carve-out (2026-06-03): a "felt-state" verb is
  // only banned when it is Jove's word, not the user's. If the user's own
  // messages contain that exact phrase (they literally said "I lose
  // myself"), it is their truest self-description and wins over the ban —
  // this is what lets the title name the pattern in the user's words
  // ("I Lose Myself When the Verdict Isn't In") instead of a narrowed
  // observable proxy ("I Scan Before Speaking Around New People"). The ban
  // still fires for any banned verb the user never said, so vague/poetic
  // titles ("I Disappear...", body-part-as-agent) are still rejected.
  for (const re of BANNED_VERBS) {
    if (re.test(trimmed) && !re.test(userText)) {
      reasons.push(`abstract/internal verb matched ${re.source}`);
    }
  }

  // Trigger word required: when/before/after/while/once/if signal the
  // specific condition that fires the behavior. Without one, the
  // headline names a what but not a when — exactly the failure mode
  // the composition prompt's "REQUIRED: name a SPECIFIC TRIGGER"
  // section is trying to prevent.
  if (!/\b(when|before|after|while|once|if)\b/i.test(trimmed)) {
    reasons.push("no trigger word (when/before/after/while/once/if)");
  }

  // Softener required when the user gave only one example. "Can" or
  // "sometimes" prevents over-claiming a recurring pattern from a
  // single data point. "Keep"/"always"/etc. are intensifiers and do
  // NOT count as softeners.
  if (isSingleExample && !/\b(can|sometimes)\b/i.test(trimmed)) {
    reasons.push("single-example headline missing 'can' or 'sometimes' softener");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Focused headline composer for retry-once. The main composer juggles
 * six outputs at once; this call does nothing but write a headline,
 * with a 60-line system prompt instead of ~170. The user prompt names
 * the prior failure explicitly so the retry knows what to avoid.
 *
 * Returns null on API failure, empty output, or any error — the caller
 * falls back to the original attempt. Never throws.
 */
async function composeHeadline(
  content: string,
  isSingleExample: boolean,
  previousAttempt: string,
  failureReasons: string[]
): Promise<string | null> {
  const softenerLine = isSingleExample
    ? '\nMANDATORY: this entry came from a single example. The headline MUST contain "can" or "sometimes" as a softener. "Keep" / "always" / "every" are intensifiers, not softeners — do not use them.'
    : "";

  const system = `You write headlines for Manual entries.

REQUIRED FORMAT: one of these shapes, exactly:
- "I [observable verb] when [specific trigger]"
- "I [observable verb] before [specific event]"
- "I [observable verb] after [specific moment]"
- "I [observable verb] while [specific activity]"

HARD RULES (every one must pass):
- 4-8 words. Hard cap.
- First word: "I". The subject is always the user. Never a body part, never a system metaphor, never a nominalization.
- Verb is OBSERVABLE AND LITERAL. Two failure modes to avoid:
  1. Abstract / internal verbs (felt states, not actions). BANNED: disappear, vanish, fade, fall apart, dissolve, come undone, lose myself, go missing, break open, shut down inside.
  2. Postural / embodied metaphors that LOOK observable but stand in for a semantic claim. AVOID: stay seated, tighten, swallow, brace, lean in, stiffen. Prefer the plainer literal verb that carries the same meaning: stay at, keep going to, sit through, wait, go quiet, leave, say, agree, ask.
- Trigger names a LITERAL situation, not a personified force. Don't write "when small talk drains" or "when the room scans" — use the event ("at low-stakes dinners," "in surface conversations").
- Trigger word required: when, before, after, while.
- BANNED subjects: Loop, Pattern, Response, Reaction, Processing, Stomach, Voice, Body, Mind, System, anything ending in -ing as agent.${softenerLine}

PASSING EXAMPLES:
- "I Freeze When Asked What I Want"
- "I Go Quiet When Someone Waits"
- "I Keep Going to Dinners That Drain Me"
- "I Stay at Conversations That Stay Surface"
- "I Wait to Answer When Someone Watches"

FAILING EXAMPLES (and why):
- "Worst-Case Loop Fills the Processing" — Loop is not the subject. "Fills" is abstract. No trigger.
- "Stomach Pushes Me to Fix the Call" — body-part as agent.
- "I Disappear When Nobody Needs Me" — Disappear is internal, not observable.
- "I Stay Seated While Small Talk Drains" — "stay seated" is postural metaphor, "small talk drains" personifies the trigger. Plain rewrite: "I Keep Going to Dinners That Drain Me."
- "I Tighten Before Answering Hard Questions" — observable but metaphorical. Plain rewrite: "I Go Quiet Before Hard Questions."
- "I Keep Following the Script" — no trigger; "Keep" is an intensifier, not a softener.

OUTPUT: just the headline. No quotes, no JSON, no preamble. Just the words.`;

  const userContent = `Manual entry text:
${content}

Previous attempt failed: "${previousAttempt}"
Failures: ${failureReasons.join("; ")}

Write a new headline that passes every rule above.`;

  try {
    const response = await anthropicFetch({
      model: COMPOSITION_MODEL,
      max_tokens: 64,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = extractResponseText(response).trim();
    if (!raw) return null;
    // Strip wrapping quotes and take only the first line so any chatter
    // the model added past the headline (rare with this prompt) doesn't
    // bleed in.
    return raw
      .split("\n")[0]
      .trim()
      .replace(/^["']/, "")
      .replace(/["']$/, "");
  } catch (err) {
    console.error("[composeHeadline] retry failed:", err);
    return null;
  }
}

interface ConfirmCheckpointOptions {
  messageId: string;
  conversationId: string;
  userId: string;
  /** User-edited content from the review overlay. Overrides composed_content
   *  when present so the user's words land in their Manual verbatim. */
  editedContent?: string | null;
  /** User-edited entry title from the review overlay. Overrides composed_name. */
  editedName?: string | null;
}

/**
 * Confirms a checkpoint. Idempotent and transactional — safe to call any
 * number of times with the same messageId.
 *
 * Loads the checkpoint message, extracts composed fields (with fallbacks),
 * then delegates all writes to the confirm_checkpoint_write Postgres
 * function, which in one transaction: inserts the manual_entries row,
 * flips the message status to "confirmed", and inserts the system message.
 *
 * Returns:
 *   success: true, componentId, wasAlreadyConfirmed: false — first-time confirm
 *   success: true, componentId, wasAlreadyConfirmed: true — already confirmed (idempotent)
 *   success: false, error — message missing, non-pending terminal state, or DB failure
 *
 * See supabase/migrations/20260417000003_confirm_idempotency.sql for the
 * RPC definition and docs/reference/checkpoint-hardening-plan.md Track 2.
 */
export async function confirmCheckpoint({
  messageId,
  userId,
  editedContent,
  editedName,
}: ConfirmCheckpointOptions): Promise<{
  success: boolean;
  error?: string;
  componentId?: string;
  wasAlreadyConfirmed?: boolean;
}> {
  const admin = createAdminClient();

  try {
    // 1. Load the checkpoint message so we can pull composed content,
    //    name, summary, key_words from checkpoint_meta. The RPC handles
    //    its own status check + lock; we only read here.
    const { data: message, error: msgError } = await admin
      .from("messages")
      .select("content, checkpoint_meta")
      .eq("id", messageId)
      .single();

    if (msgError || !message?.checkpoint_meta) {
      return { success: false, error: "Checkpoint not found." };
    }

    const meta = message.checkpoint_meta as {
      layer: number;
      name: string | null;
      status: string;
      composed_content: string | null;
      composed_name: string | null;
      changelog: string | null;
      composed_summary: string | null;
      composed_key_words: string[] | null;
    };

    // 2. Compute final field values with fallbacks. This stays in TS
    //    rather than the SQL function — composition fallback logic is
    //    business logic, not a transaction concern.
    //    Strip crisis resources from fallback content (prevents
    //    contamination of manual entries when composition didn't run).
    const CRISIS_RESOURCES_PATTERN =
      "\n\nIf you're in crisis or need immediate support, please reach out to";
    let fallbackContent = message.content;
    if (!meta.composed_content && fallbackContent) {
      const crisisIdx = fallbackContent.indexOf(CRISIS_RESOURCES_PATTERN);
      if (crisisIdx !== -1) {
        fallbackContent = fallbackContent.substring(0, crisisIdx).trimEnd();
      }
    }
    // User-edited content from the review overlay takes precedence over
    // composed_content. The user is the author — their words land in the
    // Manual verbatim. When edits are present we also recompute the summary
    // fallback so the compressed view reflects the edited text, and clear
    // composed key_words (they were derived from the unedited content).
    const trimmedEditedContent = editedContent?.trim();
    const trimmedEditedName = editedName?.trim();
    const contentToWrite =
      trimmedEditedContent || meta.composed_content || fallbackContent;
    const nameToWrite =
      trimmedEditedName || meta.composed_name || meta.name || "Untitled";
    const summaryToWrite = trimmedEditedContent
      ? deriveSummaryFromContent(trimmedEditedContent)
      : meta.composed_summary || deriveSummaryFromContent(contentToWrite);
    const keyWordsToWrite = trimmedEditedContent
      ? null
      : Array.isArray(meta.composed_key_words) && meta.composed_key_words.length > 0
        ? meta.composed_key_words
        : null;

    // 3. Atomic write via Postgres function. FOR UPDATE locks the
    //    message row so concurrent calls serialize; partial unique
    //    index on (user_id, source_message_id) prevents duplicates.
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "confirm_checkpoint_write",
      {
        p_message_id: messageId,
        p_user_id: userId,
        p_layer: meta.layer,
        p_name: nameToWrite,
        p_content: contentToWrite,
        p_summary: summaryToWrite,
        p_key_words: keyWordsToWrite,
      }
    );

    if (rpcError) {
      // Error codes raised by the function map to user-facing messages.
      // The exception message bubbles through the Supabase client as
      // `error.message`. P0002 = checkpoint_not_found, P0001 = not_pending.
      const msg = rpcError.message || "";
      if (msg.includes("checkpoint_not_found")) {
        return { success: false, error: "Checkpoint not found." };
      }
      if (msg.includes("checkpoint_not_pending")) {
        return { success: false, error: "Checkpoint was rejected or refined." };
      }
      console.error("[confirmCheckpoint] RPC failed:", rpcError);
      return {
        success: false,
        error: "Failed to write entry to manual.",
      };
    }

    const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    if (!row?.entry_id) {
      console.error("[confirmCheckpoint] RPC returned no entry id:", rpcResult);
      return { success: false, error: "Failed to write entry to manual." };
    }

    return {
      success: true,
      componentId: row.entry_id as string,
      wasAlreadyConfirmed: Boolean(row.was_already_confirmed),
    };
  } catch (err) {
    console.error("[confirmCheckpoint] Error:", err);
    return { success: false, error: "Something went wrong." };
  }
}
