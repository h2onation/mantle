export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkLimit,
  manualEditHour,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { recordApiError } from "@/lib/observability/record-api-error";
import { deriveSummaryFromContent } from "@/lib/persona/manual-context";

const NAME_MAX = 200;
const CONTENT_MAX = 5000;

/**
 * PATCH /api/manual/[id]
 *
 * Update the name and/or content of a manual entry the user owns.
 * Mirrors the in-place edit flow already available in the checkpoint
 * review overlay (see CheckpointOverlay.tsx), but for entries that
 * are already in the Manual.
 *
 * Body:  { name?: string | null, content?: string }
 *        - At least one of name or content must be provided.
 *        - Strings are trimmed before validation.
 *        - name === null clears the name (entry will render as
 *          "Untitled" in surfaces that fall back).
 *
 * Returns: { entry: ManualEntry } on success.
 *
 * When content changes, the entry's `summary` is regenerated via
 * `deriveSummaryFromContent` (first sentence, 240-char cap) and
 * `key_words` is cleared — the previously stored compression came
 * from the unedited content and would mismatch the new prose. This
 * mirrors the post-edit fallback in `confirmCheckpoint`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let capturedUserId: string | null = null;
  try {
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const limit = await checkLimit(manualEditHour, user.id);
    if (!limit.success) return rateLimitedResponse(limit);

    const entryId = params.id;
    if (!entryId || typeof entryId !== "string") {
      return Response.json(
        { error: "Missing entry id." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      name?: string | null;
      content?: string;
    } | null;

    if (!body || (body.name === undefined && body.content === undefined)) {
      return Response.json(
        { error: "Provide name and/or content." },
        { status: 400 }
      );
    }

    const updates: {
      name?: string | null;
      content?: string;
      summary?: string;
      key_words?: null;
    } = {};

    if (body.name !== undefined) {
      if (body.name === null) {
        updates.name = null;
      } else if (typeof body.name === "string") {
        const trimmed = body.name.trim();
        if (trimmed.length === 0) {
          updates.name = null;
        } else if (trimmed.length > NAME_MAX) {
          return Response.json(
            { error: `Name is too long (max ${NAME_MAX} characters).` },
            { status: 400 }
          );
        } else {
          updates.name = trimmed;
        }
      } else {
        return Response.json(
          { error: "Invalid name." },
          { status: 400 }
        );
      }
    }

    if (body.content !== undefined) {
      if (typeof body.content !== "string") {
        return Response.json(
          { error: "Invalid content." },
          { status: 400 }
        );
      }
      const trimmed = body.content.trim();
      if (trimmed.length === 0) {
        return Response.json(
          { error: "Content cannot be empty." },
          { status: 400 }
        );
      }
      if (trimmed.length > CONTENT_MAX) {
        return Response.json(
          { error: `Content is too long (max ${CONTENT_MAX} characters).` },
          { status: 400 }
        );
      }
      updates.content = trimmed;
      // Edited content invalidates the stored compression. Regenerate the
      // summary from the new prose and clear the old key_words; the next
      // checkpoint pass will populate fresh key_words if needed.
      updates.summary = deriveSummaryFromContent(trimmed);
      updates.key_words = null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No changes." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Update gated on user_id ownership — even though createAdminClient
    // bypasses RLS, the WHERE clause ensures we can only modify the
    // caller's own entry. Returns the updated row in one round-trip.
    const { data: updated, error: updateError } = await admin
      .from("manual_entries")
      .update(updates)
      .eq("id", entryId)
      .eq("user_id", user.id)
      .select("id, layer, name, content, created_at, updated_at")
      .single();

    if (updateError || !updated) {
      if (updateError?.code === "PGRST116") {
        // No row matched the (id, user_id) pair — either the entry
        // doesn't exist or belongs to another user. Same response
        // either way; do not leak existence.
        return Response.json(
          { error: "Entry not found." },
          { status: 404 }
        );
      }
      console.error("[PATCH /api/manual/[id]] update failed:", updateError);
      return Response.json(
        { error: "Failed to update entry." },
        { status: 500 }
      );
    }

    return Response.json({ entry: updated });
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/manual/[id]",
      method: "PATCH",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
