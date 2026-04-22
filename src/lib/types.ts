export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  channel?: "text" | "web" | null;
  isCheckpoint?: boolean;
  checkpointMeta?: {
    layer: number;
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
  layer: number;
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
  layer: number;
  name: string | null;
  content: string;
}

export interface ExplorationContext {
  layerId: number;
  layerName: string;
  type: "entry" | "empty_layer";
  name?: string;
  content: string;
}
