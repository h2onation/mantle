import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  CHECKPOINT_TUNING_FIELDS,
  isCheckpointTuningField,
  type CheckpointTuningField,
} from "@/lib/persona/checkpoint-tuning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One tunable dial as the admin panel needs it: the code default (always
// shown), the current live value, whether it's been edited off the default,
// and the bounds the panel renders its control from.
interface TuningFieldView {
  field: CheckpointTuningField;
  label: string;
  help: string;
  kind: "int";
  default: number;
  value: number;
  edited: boolean;
  min: number;
  max: number;
}

type RawRow = {
  cooldown_turns: number | null;
};

// Is the stored column a real override (non-null AND in range)? A null or
// out-of-range column resolves to the code default — same fail-safe rule the
// getter applies — so it should read as DEFAULT, not EDITED.
function isValidOverride(field: CheckpointTuningField, raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const spec = CHECKPOINT_TUNING_FIELDS[field];
  return (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= spec.min &&
    raw <= spec.max
  );
}

// Read every dial: code default + current live value + edited state. Admin only.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const { data } = await admin
    .from("checkpoint_tuning")
    .select("cooldown_turns")
    .eq("id", true)
    .maybeSingle();
  const row = (data ?? null) as RawRow | null;

  const fields: TuningFieldView[] = (
    Object.keys(CHECKPOINT_TUNING_FIELDS) as CheckpointTuningField[]
  ).map((field) => {
    const spec = CHECKPOINT_TUNING_FIELDS[field];
    const raw = row ? row[spec.column as keyof RawRow] : null;
    const edited = isValidOverride(field, raw);
    return {
      field,
      label: spec.label,
      help: spec.help,
      kind: spec.kind,
      default: spec.default,
      value: edited ? (raw as number) : spec.default,
      edited,
      min: spec.min,
      max: spec.max,
    };
  });

  return Response.json({ fields });
}

// Save or reset one dial. Admin only.
//   { field, value }       → save: upsert the singleton row's column, after a
//                            type + bounds/enum check. Records the change in
//                            checkpoint_tuning_history (old → new).
//   { field, reset: true } → reset to the code default: null the column
//                            (non-destructive; history keeps the prior value).
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as {
    field?: unknown;
    value?: unknown;
    reset?: unknown;
  } | null;

  if (!body || !isCheckpointTuningField(body.field)) {
    return Response.json(
      {
        error:
          "Body must include field, one of: " +
          Object.keys(CHECKPOINT_TUNING_FIELDS).join(", "),
      },
      { status: 400 },
    );
  }
  const field = body.field;
  const spec = CHECKPOINT_TUNING_FIELDS[field];
  const column = spec.column;

  // Read the prior column value so the history row records old → new.
  const { data: prior } = await admin
    .from("checkpoint_tuning")
    .select(column)
    .eq("id", true)
    .maybeSingle();
  const oldValue =
    prior && column in prior
      ? (prior as Record<string, number | string | null>)[column]
      : null;

  // Reset path: null the column so the code default resolves again next turn.
  if (body.reset === true) {
    const { error } = await admin
      .from("checkpoint_tuning")
      .upsert(
        { id: true, [column]: null, updated_at: new Date().toISOString(), updated_by: userId },
        { onConflict: "id" },
      );
    if (error) {
      return Response.json({ error: "Failed to reset dial" }, { status: 500 });
    }
    return Response.json({ ok: true, field, reset: true });
  }

  // Save path — validate against the field's type + bounds.
  const n = body.value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < spec.min || n > spec.max) {
    return Response.json(
      { error: `value must be an integer between ${spec.min} and ${spec.max}` },
      { status: 400 },
    );
  }
  const value: number = n;

  const { error: upsertError } = await admin
    .from("checkpoint_tuning")
    .upsert(
      { id: true, [column]: value, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "id" },
    );
  if (upsertError) {
    return Response.json({ error: "Failed to save dial" }, { status: 500 });
  }

  // Append the audit row. Best-effort: a history-write failure must not fail
  // the save (the override is already live). Values are non-sensitive config.
  const { error: historyError } = await admin
    .from("checkpoint_tuning_history")
    .insert({
      field,
      old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
      new_value: String(value),
      updated_by: userId,
    });
  if (historyError) {
    console.warn("[checkpoint-tuning] history write failed for field=%s", field);
  }

  return Response.json({ ok: true, field, value });
}
