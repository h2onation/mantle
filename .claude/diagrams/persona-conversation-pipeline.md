# Jove Conversation Pipeline

How a single user message flows through the system and produces a Jove response.

```mermaid
flowchart TD
    A[User sends message] --> B[POST /api/chat]
    B --> C["Parallel DB reads<br/>(history, manual_components, extraction_state)"]
    C --> D[buildSystemPrompt<br/>using PREVIOUS extraction state]
    D --> E[Jove streams response via SSE]
    D --> F["runExtraction() fires in background<br/>(not awaited — zero latency)"]

    E --> K[Haiku classifier runs post-stream]
    K --> L{Checkpoint detected?}
    L -- No --> M[Save message to DB<br/>no checkpoint]
    L -- Yes --> N["composeManualEntry() via Sonnet<br/>compose polished entry"]
    N --> J[Save message + checkpoint_meta to DB]

    J --> O["Send message_complete SSE event<br/>(includes checkpoint data if any)"]
    M --> O
    F --> P[Save updated extraction_state<br/>to conversations table]

    O --> Q{Client: checkpoint?}
    Q -- No --> R[Display message]
    Q -- Yes --> S[Show checkpoint card<br/>confirm / reject / refine]

    S --> T[POST /api/checkpoint/confirm]
    T --> U["confirmCheckpoint() utility<br/>upsert to manual_components"]
    U --> V[Insert system message in DB]
    V --> W[Stream Jove follow-up]
```

## Key design decisions

- **1-turn lag**: Jove always sees the PREVIOUS turn's extraction state. Since extraction is cumulative, the lag is negligible.
- **Single path**: Jove responds → Haiku classifier flags candidate turns → `composeManualEntry()` (Sonnet) writes the polished manual entry server-side. Jove never emits manual-entry blocks inline.
- **composed_content is never null on confirmed checkpoints**: Two defenses — server-side composition at detection time, and msg.content fallback in `confirmCheckpoint()`.
