# Key User Flows

## Onboarding (new user, first visit)

```mermaid
flowchart TD
    A["Visit mantle"] --> B["/login — splash screen"]
    B --> C["'Get Started' button"]
    C --> D["'How It Works' screen"]
    D --> E["'Before You Start' screen<br/>(age gate, no text input)"]
    E --> F["Anonymous account created silently"]
    F --> G["Dissolve transition into chat"]
    G --> H["Welcome block + 3 tappable chips"]
    H --> I["User taps a chip → first message to Sage"]
    I --> J["Conversation begins"]
```

## Checkpoint lifecycle (confirming a manual entry)

```mermaid
flowchart TD
    A[User and Sage are in conversation] --> B{Sage detects<br/>checkpoint-worthy moment}
    B -- "Path A: Sage composes inline" --> C["Sage includes |||MANUAL_ENTRY||| block<br/>(suppressed from user view)"]
    B -- "Path B: Haiku detects post-stream" --> D["Haiku classifier flags checkpoint<br/>Sonnet composes polished entry"]
    C --> E["Checkpoint card appears inline in chat"]
    D --> E
    E --> F{User response}
    F -- Confirm --> G["Entry saved to manual_components"]
    G --> H["System message logged:<br/>'User confirmed the checkpoint'"]
    H --> I["Sage acknowledges and continues"]
    F -- Reject --> J["System message logged:<br/>'User rejected the checkpoint'"]
    J --> K["Sage pivots"]
    F -- Refine --> L["System message logged:<br/>'User wants to refine'"]
    L --> M["Sage adjusts entry"]
```

## Layer discovery progression

```mermaid
flowchart LR
    A["Layer starts<br/>discovery_mode: component"] --> B["First checkpoint on layer<br/>MUST be type: component"]
    B --> C["User confirms component"]
    C --> D["discovery_mode flips to pattern"]
    D --> E["Patterns discovered<br/>(max 2 per layer)"]
    E --> F["Layer complete:<br/>1 component + up to 2 patterns"]
```

## Session flow (returning user)

```mermaid
flowchart TD
    A[User opens app] --> B["Middleware refreshes session"]
    B --> C["MainApp loads"]
    C --> D{"Last message > 30 min old?"}
    D -- Yes --> E["Generate session summary<br/>(fire-and-forget, Haiku)"]
    D -- No --> F["Resume existing conversation"]
    E --> F
    F --> G["User sends message"]
    G --> H["Sage responds with extraction context<br/>(knows user's manual, language bank)"]
    H --> I{"Checkpoint approaching?"}
    I -- Yes --> J["System prompt includes<br/>checkpoint instructions"]
    I -- No --> K["Continue deepening conversation"]
    J --> L["Sage may produce checkpoint"]
```

## Manual view

```mermaid
flowchart TD
    A["User taps Manual tab"] --> B["GET /api/manual"]
    B --> C["Fetch manual_components for user"]
    C --> D["buildLayers() groups by layer 1-5"]
    D --> E{Has content?}
    E -- Yes --> F["Populated layers render in MeadowZone<br/>(green feathered panels)"]
    E -- No --> G["Empty layers render on dark void"]
    F --> H["Each layer shows:<br/>component name + content<br/>+ pattern cards (expandable)"]
    H --> I["'Explore with Sage' buttons<br/>launch targeted conversation"]
```

## Conversation modes (Sage self-manages)

```mermaid
flowchart LR
    M1["Mode 1<br/>Situation-Led<br/>(start here)"] --> M2["Mode 2<br/>Direct Exploration<br/>(after 2+ checkpoints)"]
    M2 --> M3["Mode 3<br/>Synthesis<br/>(all 5 layers have components)"]
    M3 --> DONE["Readiness Gate:<br/>'See your manual<br/>or keep building?'"]
```
