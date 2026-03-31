export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  channel?: "text" | "web" | null;
  isCheckpoint?: boolean;
  checkpointMeta?: {
    layer: number;
    type: string;
    name: string | null;
    status: string;
  } | null;
}

export interface ManualComponent {
  id?: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
  created_at?: string;
}

export interface ActiveCheckpoint {
  messageId: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

export interface ExplorationContext {
  layerId: number;
  layerName: string;
  type: "pattern" | "component" | "empty_layer";
  name?: string;
  content: string;
}
