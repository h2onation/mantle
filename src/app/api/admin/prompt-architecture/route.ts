import { verifyAdmin } from "@/lib/admin/verify-admin";
import { buildAllPhases } from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERSONAS: PersonaMode[] = ["autistic", "audhd", "dyslexic", "general"];
const VALID_CONV_MODES = ["situation", "guided-intake", "upload"] as const;

export async function GET(request: Request) {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const modesParam = url.searchParams.get("personaModes") || "autistic";
  const convModeParam = url.searchParams.get("convMode") || "situation";

  const personaModes = modesParam
    .split(",")
    .filter((m): m is PersonaMode => VALID_PERSONAS.includes(m as PersonaMode));
  if (personaModes.length === 0) personaModes.push("autistic");

  const convMode = VALID_CONV_MODES.includes(convModeParam as (typeof VALID_CONV_MODES)[number])
    ? (convModeParam as (typeof VALID_CONV_MODES)[number])
    : "situation";

  const phases = buildAllPhases(personaModes, convMode);

  return Response.json({ phases });
}
