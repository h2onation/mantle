export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  channel?: "text" | "web" | null;
  isCheckpoint?: boolean;
  chips?: string[];
  // Guided-intake: render the canonical section picker under this (tee-up)
  // message. The sections come from layers.ts (client-canonical), not stored
  // here — this is only the "show it" flag.
  showSections?: boolean;
  // Guided-intake: render the one-tap "take this to its own conversation"
  // action under this message (set only after the user accepts the handoff).
  offerStartSituation?: boolean;
  checkpointMeta?: {
    // Section slug chosen by composition — always one of the five life-area
    // sections. Replaces the legacy `layer` number. Nullable only to tolerate
    // in-flight checkpoint_meta written before parking was removed.
    section: string | null;
    // Closed tag set applied by composition (strength / romantic / family / friends).
    tags?: string[];
    name: string | null;
    status: string;
    // Number of "Close but not quite" refinements that produced this
    // entry. Inherited via the chain rule — see
    // computeInheritedRefinementCount in persona-pipeline.ts. Optional
    // for backward compatibility with checkpoint_meta rows that
    // predate the field; reader treats undefined as 0.
    refinement_count?: number;
  } | null;
}

export interface ManualEntry {
  id?: string;
  // FROZEN legacy pattern-type id. Existing rows keep it; new rows are born
  // with `section` and a null layer. Never the structural key going forward.
  layer?: number | null;
  // Life-area section slug — the structural key. One of the five sections on
  // every new entry (null only on un-refiled legacy rows).
  section?: string | null;
  // Closed cross-cutting tag set.
  tags?: string[] | null;
  name: string | null;
  content: string;
  created_at?: string;
  // Compression fields — populated at checkpoint-confirm time. When present,
  // prepareManualContext uses them to render older entries as a terse line
  // instead of the full narrative content.
  summary?: string | null;
  key_words?: string[] | null;
  // Conversation the entry was authored in. Used by prepareManualContext to
  // distinguish "current session" entries (full) from older ones (compressed).
  source_conversation_id?: string | null;
}

export interface ActiveCheckpoint {
  messageId: string;
  /** Section slug chosen by composition — one of the five life-area sections. */
  section: string | null;
  tags?: string[];
  name: string | null;
  /** The assistant message content as it appears in the chat stream.
   *  Kept as a fallback for the review overlay when composition didn't run. */
  content: string;
  /** Polished entry text produced by composeManualEntry at proposal time.
   *  This is what will land in the user's Manual on confirm, so the review
   *  overlay shows this when present rather than `content`. */
  composedContent?: string | null;
}

export interface ExplorationContext {
  layerId: number;
  layerName: string;
  type: "entry" | "empty_layer" | "started_layer";
  name?: string;
  content: string;
}
