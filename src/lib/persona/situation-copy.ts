// The fixed opener for the Situation door (the core loop). Server-emitted as
// turn 1 of every situation conversation, verbatim, with no model call — so it
// can't drift the way a model-generated opener does (the "what's on your mind
// today?" drift that made every session start on a topic, not a scene).
// Admin-editable via the Tuning page → Intake doors (the `situation_opener`
// override key); this constant is the permanent code floor. Parallels
// UPLOAD_OPENER (upload-copy.ts). Revived 2026-07-08 (v0.8.2).
export const SITUATION_OPENER =
  "What situation is top of mind for you right now that would be helpful to better understand.";
