# Sage Conversation Pipeline

How a single user message flows through the system and produces a Sage response.

```mermaid
flowchart TD
    A[User sends message] --> B[POST /api/chat]
    B --> C["Parallel DB reads<br/>(history, manual_components, extraction_state)"]
    C --> D[buildSystemPrompt<br/>using PREVIOUS extraction state]
    D --> E[Sage streams response via SSE]
    D --> F["runExtraction() fires in background<br/>(not awaited — zero latency)"]

    E --> G{Delimiter buffer:<br/>|||MANUAL_ENTRY||| found?}

    G -- "Yes (Path A)" --> H[Parse manual entry block<br/>layer, type, name, content, changelog]
    H --> I[Skip classifier]
    I --> J[Save message + checkpoint_meta to DB]

    G -- "No (Path B)" --> K[Haiku classifier runs post-stream]
    K --> L{Checkpoint detected?}
    L -- No --> M[Save message to DB<br/>no checkpoint]
    L -- Yes --> N["composeManualEntry() via Sonnet<br/>compose polished entry"]
    N --> J

    J --> O["Send message_complete SSE event<br/>(includes checkpoint data if any)"]
    M --> O
    F --> P[Save updated extraction_state<br/>to conversations table]

    O --> Q{Client: checkpoint?}
    Q -- No --> R[Display message]
    Q -- Yes --> S[Show checkpoint card<br/>confirm / reject / refine]

    S --> T[POST /api/checkpoint/confirm]
    T --> U["confirmCheckpoint() utility<br/>upsert to manual_components"]
    U --> V[Insert system message in DB]
    V --> W[Stream Sage follow-up]
```

## Key design decisions

- **1-turn lag**: Sage always sees the PREVIOUS turn's extraction state. Since extraction is cumulative, the lag is negligible.
- **Delimiter buffer**: Streams token-by-token but prefix-matches against `|||MANUAL_ENTRY|||` to suppress it from reaching the client.
- **Dual path**: Path A (Sage composes inline) is preferred. Path B (Haiku classifier + Sonnet composition) is the fallback.
- **composed_content is never null on confirmed checkpoints**: Three defenses ensure this — Sage inline block, Path B composition, and msg.content fallback in confirmCheckpoint().
