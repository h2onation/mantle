import { requireAdmin } from "@/lib/admin/verify-admin";
import { buildAllPhases } from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import { CONVERSATION_MODES, type ConversationMode } from "@/lib/persona/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERSONAS: PersonaMode[] = ["autistic", "adhd", "dyslexic", "general"];

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  // Empty selection mirrors composeTier2: no modes → general (the fallback).
  const modesParam = url.searchParams.get("personaModes") || "general";
  const convModeParam = url.searchParams.get("convMode") || "situation";

  const personaModes = modesParam
    .split(",")
    .filter((m): m is PersonaMode => VALID_PERSONAS.includes(m as PersonaMode));
  if (personaModes.length === 0) personaModes.push("general");

  const convMode: ConversationMode = (CONVERSATION_MODES as readonly string[]).includes(convModeParam)
    ? (convModeParam as ConversationMode)
    : "situation";

  const phases = buildAllPhases(personaModes, convMode);

  return Response.json({ phases });
}
