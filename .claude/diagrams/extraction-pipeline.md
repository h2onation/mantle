# Extraction Pipeline

The extraction layer runs in parallel with Sage to analyze conversation depth, track user language, and assess checkpoint readiness — without adding any latency.

## Per-turn flow

```mermaid
sequenceDiagram
    participant User
    participant API as /api/chat
    participant DB as Supabase
    participant Sage as Sage (Sonnet)
    participant Ext as Extraction (Sonnet)

    User->>API: Send message
    API->>DB: Parallel reads (history, manual, extraction_state)
    DB-->>API: Previous extraction state (turn N-1)

    par Sage streams response
        API->>Sage: buildSystemPrompt(prev extraction) + history
        Sage-->>API: Stream tokens via SSE
        API-->>User: text_delta events
    and Extraction runs in background
        API->>Ext: Last 6 messages + previous state
        Ext-->>DB: Save updated extraction_state (turn N)
    end

    Note over API,DB: Sage sees turn N-1 extraction.<br/>Extraction produces turn N state.<br/>1-turn lag, negligible because cumulative.
```

## What extraction produces

```mermaid
flowchart TD
    INPUT["Last 6 messages<br/>+ previous ExtractionState"] --> EXT["Extraction (Sonnet)"]

    EXT --> LS["Layer Signals<br/>per layer: signal level + discovery mode"]
    EXT --> LB["Language Bank<br/>user's exact phrases worth echoing"]
    EXT --> DT["Depth Tracking<br/>surface / developing / deep / transformative"]
    EXT --> CG["Checkpoint Gate<br/>examples, mechanism, charged language,<br/>behavior-driver link"]
    EXT --> NP["Next Prompt<br/>suggested follow-up direction"]
    EXT --> SB["Sage Brief<br/>1-2 sentence summary for Sage"]
    EXT --> CF["Clinical Flag<br/>crisis detection (blocks checkpoint gate)"]
```

## How extraction feeds back into Sage

```mermaid
flowchart LR
    A["Turn N extraction<br/>saved to DB"] --> B["Turn N+1: loaded from DB"]
    B --> C["formatExtractionForSage()"]
    C --> D["Injected into system prompt:<br/>- Layer signal summary<br/>- Target type per layer<br/>- Language bank (user's words)<br/>- Depth + gate status<br/>- Sage brief"]
    D --> E["Sage uses context<br/>to deepen conversation"]
```

## Signal levels per layer

| Signal | Meaning |
|--------|---------|
| `none` | Layer not touched yet |
| `mentioned` | User briefly referenced this area |
| `emerging` | Patterns forming, worth exploring |
| `explored` | Rich material, approaching checkpoint |
| `checkpoint_ready` | Enough depth for a manual entry |
