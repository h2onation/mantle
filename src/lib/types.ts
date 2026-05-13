export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  channel?: "text" | "web" | null;
  isCheckpoint?: boolean;
  chips?: string[];
  checkpointMeta?: {
    layer: number;
    name: string | null;
    status: string;
    composed_so_what?: string | null;
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
  layer: number;
  name: string | null;
  content: string;
  created_at?: string;
  // The user's stance on the pattern: what changes now that they can see it.
  // Nullable — entries before this feature, or entries where the user hasn't
  // landed on a stance, have no so_what.
  so_what?: string | null;
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
  layer: number;
  name: string | null;
  /** The assistant message content as it appears in the chat stream.
   *  Kept as a fallback for the review overlay when composition didn't run. */
  content: string;
  /** Polished entry text produced by composeManualEntry at proposal time.
   *  This is what will land in the user's Manual on confirm, so the review
   *  overlay shows this when present rather than `content`. */
  composedContent?: string | null;
  composedSoWhat?: string | null;
}

export interface ExplorationContext {
  layerId: number;
  layerName: string;
  type: "entry" | "empty_layer";
  name?: string;
  content: string;
}
