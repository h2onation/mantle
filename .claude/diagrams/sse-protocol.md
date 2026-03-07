# SSE Streaming Protocol

All streaming responses (chat + checkpoint confirm) use the same event format.

## Event types

```mermaid
sequenceDiagram
    participant Client as Browser (useChat)
    participant Server as API Route

    Client->>Server: POST /api/chat or /api/checkpoint/confirm

    loop Token streaming
        Server-->>Client: data: {"type":"text_delta","text":"chunk"}
    end

    Server-->>Client: data: {"type":"message_complete",...}

    Note over Client: message_complete carries:<br/>messageId, conversationId,<br/>checkpoint (if any), processingText,<br/>nextPrompt, cleanContent
```

## Message complete payload

```mermaid
flowchart TD
    MC["message_complete event"] --> MID["messageId: uuid"]
    MC --> CID["conversationId: uuid"]
    MC --> CP{"checkpoint: null or object"}
    CP -- "null" --> NONE["No checkpoint detected"]
    CP -- "object" --> CPDATA["isCheckpoint: true<br/>layer: 1-5<br/>type: component|pattern<br/>name: string"]
    MC --> PT["processingText: tracking phrase"]
    MC --> NP["nextPrompt: placeholder hint"]
    MC --> CC{"cleanContent: string or null"}
    CC -- "non-null" --> DELIM["Delimiter was found —<br/>this is the text WITHOUT<br/>the |||MANUAL_ENTRY||| block"]
    CC -- "null" --> FULL["No delimiter —<br/>full text already shown"]
```

## Error handling

```mermaid
flowchart LR
    ERR["Server error"] --> EVT["data: {'type':'error','message':'..'}"]
    EVT --> CLOSE["Stream closes"]
    CLOSE --> CLIENT["Client shows error<br/>+ retry button"]
```

## Client-side parsing

The `parseSSEStream()` utility in `sse-parser.ts` handles:
- Chunked SSE data (may split across network packets)
- Malformed JSON recovery
- Null response body detection
- Buffered rendering (text shown in one shot, not streamed incrementally)
