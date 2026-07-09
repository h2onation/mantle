export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadConversationContext,
  buildCheckpointMeta,
} from "@/lib/persona/persona-pipeline";
import {
  composeManualEntry,
  type ComposedEntry,
} from "@/lib/persona/confirm-checkpoint";
import { composeEntryAsConductor } from "@/lib/persona/compose-as-conductor";
import { getComposerMode } from "@/lib/persona/composer-mode";
import { LAYERS, TAGS, RELATIONSHIP_TAGS } from "@/lib/manual/layers";
import {
  reflectionComposeHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { hashUserId, logEvent } from "@/lib/observability/log";
import { checkAnonCheckpointGate } from "@/lib/auth/anon-checkpoint-gate";

/**
 * User-pulled Reflection composition. The client calls this when the user
 * taps "Build this reflection". It composes the
 * entry on demand by reusing `composeManualEntry` — no Jove turn, no
 * transition line — and writes the SAME `is_checkpoint` message row the
 * Jove-pushed path writes, so the existing `/api/checkpoint/confirm` route,
 * the review overlay, and reload-resume all work unchanged.
 *
 * The reflection meter (pull model) is the unconditional web capture surface,
 * so this route has no feature gate of its own — ownership, the anonymous
 * conversion gate, and the rate limiter are the only guards before the Opus call.
 *
 * The composer mode (getComposerMode — admin toggle on the Feature gates page,
 * falling back to the COMPOSER_MODE env var, then the default) selects who
 * writes the entry:
 *   - "composer" (default) — the separate composer re-reads the transcript.
 *   - "conductor" — the conductor writes it from full live context.
 *   - "compare" — run BOTH in parallel, return both candidates without writing
 *     a row; the client shows them side by side and calls back with `pick`
 *     (the chosen candidate) to materialize the one pending row.
 * Temporary A/B scaffolding — the loser path + this branch are deleted once the
 * test picks a winner. See docs/state.md.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  // 1. Authenticate.
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const userIdHash = await hashUserId(user.id);

  const { conversationId, pick } = (await request.json()) as {
    conversationId?: string;
    // Compare-mode second step: the candidate the user chose. Present only when
    // COMPOSER_MODE=compare and the client is materializing a pick — no Opus
    // call, just the pending-row write the single-entry modes do inline.
    pick?: Partial<ComposedEntry> | null;
  };
  if (!conversationId) {
    return Response.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Ownership. The admin client bypasses RLS, so this is the only
  //    boundary. 404 (not 403) so a probing user can't distinguish a foreign
  //    id from a missing one — matches the chat route.
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv || conv.user_id !== user.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // 3. Anonymous conversion gate (shared with /api/chat) — before the rate
  //    limiter or any Opus call, so a converted-out anonymous user never burns
  //    quota or tokens.
  const anonBlock = await checkAnonCheckpointGate(admin, user);
  if (anonBlock) return Response.json(anonBlock);

  // Writes a composed entry as the single pending checkpoint row and returns the
  // payload the client opens the review overlay on. Shared by the normal
  // single-entry modes and the compare-mode pick below.
  const respondWithRow = async (entry: ComposedEntry) => {
    const { data: row, error: rowErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: entry.content,
        is_checkpoint: true,
        checkpoint_meta: buildCheckpointMeta(entry),
      })
      .select("id")
      .single();
    if (rowErr || !row?.id) {
      return Response.json({ error: "row_write_failed" }, { status: 500 });
    }
    return Response.json({
      messageId: row.id,
      durationMs: Date.now() - startedAt,
      checkpoint: {
        isCheckpoint: true,
        section: entry.section,
        tags: entry.tags,
        name: entry.name,
        refinement_count: 0,
        composed_content: entry.content,
      },
    });
  };

  // Compare-mode step 2: the client picked one of the two candidates. Write it
  // as the pending row — no Opus call, no rate limit (the entry was already
  // composed in the compare step). The picked entry is client-supplied, but the
  // user authors their own Manual anyway (they can edit any word in the overlay
  // before confirm), so we only sanitize the structural fields.
  if (pick) {
    const entry = sanitizePickedEntry(pick);
    if (!entry) {
      return Response.json({ error: "invalid_pick" }, { status: 400 });
    }
    return respondWithRow(entry);
  }

  // 4. Rate limit (this triggers an Opus composition).
  const limit = await checkLimit(reflectionComposeHour, user.id);
  if (!limit.success) return rateLimitedResponse(limit);

  // 4b. Idempotency. If the last message is already a pending reflection (a
  //     double-tap, or a retry after a flaky network where the first compose
  //     actually succeeded), return THAT one instead of composing a duplicate
  //     row and burning a second Opus call. The client re-opens the same
  //     overlay; confirm is idempotent on the message id either way.
  const { data: lastMsg } = await admin
    .from("messages")
    .select("id, content, is_checkpoint, checkpoint_meta")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMeta = lastMsg?.checkpoint_meta as {
    status?: string;
    section?: string | null;
    tags?: string[];
    name?: string | null;
    composed_name?: string | null;
    composed_content?: string | null;
  } | null;
  if (lastMsg?.is_checkpoint && lastMeta?.status === "pending") {
    return Response.json({
      messageId: lastMsg.id,
      reused: true,
      checkpoint: {
        isCheckpoint: true,
        section: lastMeta.section ?? null,
        tags: lastMeta.tags ?? [],
        name: lastMeta.composed_name ?? lastMeta.name ?? null,
        refinement_count: 0,
        composed_content: lastMeta.composed_content ?? lastMsg.content,
      },
    });
  }

  // 5. Load context and compose on demand. COMPOSER_MODE selects who writes it.
  const ctx = await loadConversationContext(
    admin,
    conversationId,
    user.id,
    "web"
  );
  const ext = ctx.previousExtraction;
  const mode = await getComposerMode(admin);
  const entryBarOverride = ctx.voiceOverrides?.composerEntryBar;
  const distinctContexts = ext?.checkpoint_gate?.distinct_contexts ?? null;

  const composeStart = Date.now();
  const logComposeLatency = () =>
    logEvent({
      event: "composition_latency",
      user_id_hash: userIdHash,
      conversation_id: conversationId,
      duration_ms: Date.now() - composeStart,
      manual_entry_count: ctx.manualComponents?.length ?? 0,
    });

  // Composer mode — the separate save-time call that re-reads the transcript
  // (50-message window) plus the accumulated extraction understanding. This is
  // the control; its inputs are unchanged.
  const runComposer = () =>
    composeManualEntry({
      conversationHistory: ctx.messages,
      languageBank: ext?.language_bank || [],
      manualComponents: ctx.manualComponents || [],
      distinctContexts,
      depth: ext?.depth ?? null,
      sageBrief: ext?.sage_brief ?? null,
      currentThread: ext?.current_thread ?? null,
      entryBarOverride,
      // The conversation built the entry in the open, so the body reproduces the
      // user-approved working version near-verbatim rather than re-authoring.
      anchorApprovedVersion: true,
    });
  // Conductor composer — the conductor writes the entry itself from full live
  // context. Drops the extraction supplements (redundant when it holds the whole
  // conversation). Its writing standard lives in the conductor prompt, so the
  // entry-bar override doesn't apply here.
  const runConductor = () =>
    composeEntryAsConductor(ctx, { distinctContexts });

  // A throw (e.g. Opus returns non-JSON → JSON.parse throws) is treated like a
  // null return: suppressed so the client keeps the meter full and can re-tap.
  // Only the error TYPE + conversation id are logged, never the message (it can
  // embed model output derived from the user). See CLAUDE.md Security Rules.
  const safeCompose = async (
    fn: () => Promise<ComposedEntry | null>,
    label: string
  ): Promise<ComposedEntry | null> => {
    try {
      return await fn();
    } catch (err) {
      console.error(
        "[compose] Composition threw, suppressing:",
        label,
        err instanceof Error ? err.name : typeof err,
        "conversation:",
        conversationId
      );
      return null;
    }
  };

  // Compare mode: run BOTH in parallel, return both candidates WITHOUT writing a
  // row. The client shows them side by side and POSTs `pick` (above) to
  // materialize the chosen one. 2× Opus per pull — test-only, gone at cleanup.
  if (mode === "compare") {
    const [composer, conductor] = await Promise.all([
      safeCompose(runComposer, "composer"),
      safeCompose(runConductor, "conductor"),
    ]);
    logComposeLatency();
    const candidates = [
      { label: "composer", entry: composer },
      { label: "conductor", entry: conductor },
    ].filter((c) => c.entry);
    if (candidates.length === 0) {
      return Response.json({ error: "compose_failed" }, { status: 502 });
    }
    return Response.json({
      compare: true,
      candidates,
      durationMs: Date.now() - startedAt,
    });
  }

  // Single-entry modes (composer default, or conductor).
  const composed = await safeCompose(
    mode === "conductor" ? runConductor : runComposer,
    mode
  );
  logComposeLatency();

  // null on failure or invalid section — retryable error rather than a malformed
  // row. The client keeps the meter full + the strip so the user can re-tap.
  if (!composed) {
    return Response.json({ error: "compose_failed" }, { status: 502 });
  }

  // Write the checkpoint row + return the payload the review overlay opens on;
  // confirm goes through /api/checkpoint/confirm unchanged.
  return respondWithRow(composed);
}

/** Coerce a client-supplied compare pick into a valid ComposedEntry, or null if
 *  it has no usable body. Only the structural fields (section slug, closed tag
 *  set) are sanitized — the prose is the user's to author. */
function sanitizePickedEntry(
  pick: Partial<ComposedEntry>
): ComposedEntry | null {
  if (typeof pick.content !== "string" || !pick.content.trim()) return null;
  const sectionSlugs = LAYERS.map((l) => l.slug);
  const section =
    typeof pick.section === "string" && sectionSlugs.includes(pick.section)
      ? pick.section
      : "relationships";
  const allowed = TAGS as readonly string[];
  const relTags = RELATIONSHIP_TAGS as readonly string[];
  const tags = (Array.isArray(pick.tags) ? pick.tags : [])
    .filter((t): t is string => typeof t === "string")
    .filter((t) => allowed.includes(t))
    .filter((t) => (relTags.includes(t) ? section === "relationships" : true));
  return {
    content: pick.content,
    name:
      typeof pick.name === "string" && pick.name.trim() ? pick.name : "Untitled",
    section,
    tags,
    changelog:
      typeof pick.changelog === "string" && pick.changelog.trim()
        ? pick.changelog
        : "Created entry.",
    summary: typeof pick.summary === "string" ? pick.summary : "",
    key_words: Array.isArray(pick.key_words)
      ? pick.key_words.filter((w): w is string => typeof w === "string")
      : [],
  };
}
