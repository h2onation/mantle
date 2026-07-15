export const runtime = "edge";

import { requireAdmin } from "@/lib/admin/verify-admin";
import { generateSimulatedUserMessage } from "@/lib/persona/simulate-user";

/**
 * One simulated-user turn for the live, client-driven module simulator.
 *
 * The client drives the REAL conversation (startConversation → /api/chat, the
 * same paths a user hits), so this route owns no conversation state. It takes
 * the visible transcript plus any tappable options currently on screen and
 * returns the single next line the simulated user would say (or tap). Admin-only
 * — the gate is the limiter, matching the dev-tools convention.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  let description = "";
  let history: { role: "user" | "assistant"; content: string }[] = [];
  let availableOptions: string[] | undefined;
  let isCheckpointResponse = false;

  try {
    const body = await request.json();
    if (typeof body.simulatedUserDescription === "string") {
      description = body.simulatedUserDescription.trim();
    }
    if (Array.isArray(body.history)) {
      history = body.history
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            !!m &&
            typeof m === "object" &&
            (((m as { role?: unknown }).role === "user") ||
              ((m as { role?: unknown }).role === "assistant")) &&
            typeof (m as { content?: unknown }).content === "string"
        )
        .map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
    }
    if (
      Array.isArray(body.availableOptions) &&
      body.availableOptions.every((o: unknown) => typeof o === "string") &&
      body.availableOptions.length > 0
    ) {
      availableOptions = body.availableOptions as string[];
    }
    isCheckpointResponse = body.isCheckpointResponse === true;
  } catch {
    // Invalid JSON — fall through to the validation below.
  }

  if (!description) {
    return Response.json(
      { error: "simulatedUserDescription is required" },
      { status: 400 }
    );
  }

  try {
    const message = await generateSimulatedUserMessage(
      description,
      history,
      isCheckpointResponse,
      availableOptions
    );
    return Response.json({ message });
  } catch (err) {
    console.error("[dev-simulate/turn] Error:", err instanceof Error ? err.name : typeof err);
    return Response.json({ error: "Generation failed" }, { status: 502 });
  }
}
