# Database Schema & Table Relationships

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : "trigger creates"
    PROFILES ||--o{ CONVERSATIONS : "has many"
    PROFILES ||--o{ MANUAL_COMPONENTS : "has many"
    PROFILES ||--o{ MANUAL_CHANGELOG : "has many"
    PROFILES ||--o{ SAFETY_EVENTS : "has many"
    PROFILES ||--o{ ADMIN_ACCESS_LOGS : "logged by"
    PROFILES ||--o| PHONE_NUMBERS : "links phone"
    CONVERSATIONS ||--o{ MESSAGES : "contains"
    CONVERSATIONS ||--o{ SAFETY_EVENTS : "may trigger"
    CONVERSATIONS ||--o{ MANUAL_CHANGELOG : "referenced by"
    MESSAGES ||--o| MANUAL_COMPONENTS : "source_message_id"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb app_metadata "role: admin"
        bool is_anonymous
        timestamptz created_at
    }

    PROFILES {
        uuid id PK "FK to auth.users"
        text display_name
        timestamptz created_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        text status "active | completed"
        text summary
        jsonb extraction_state "ExtractionState object"
        timestamptz created_at
        timestamptz updated_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        text role "user | assistant | system"
        text content
        bool is_checkpoint
        jsonb checkpoint_meta "layer, type, name, status, composed_content"
        text processing_text
        jsonb extraction_snapshot "per-turn extraction state"
        timestamptz created_at
    }

    MANUAL_COMPONENTS {
        uuid id PK
        uuid user_id FK
        int layer "1-5"
        text type "component | pattern"
        text name
        text content
        uuid source_message_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    MANUAL_CHANGELOG {
        uuid id PK
        uuid user_id FK
        uuid component_id
        int layer "1-5"
        text type "component | pattern"
        text name
        text previous_content
        text new_content
        text change_description
        uuid conversation_id FK
        timestamptz created_at
    }

    SAFETY_EVENTS {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        bool crisis_detected
        bool sage_included_988
        timestamptz created_at
    }

    ADMIN_ACCESS_LOGS {
        uuid id PK
        uuid admin_id FK
        uuid target_user_id
        uuid conversation_id
        text action
        timestamptz created_at
    }

    PHONE_NUMBERS {
        uuid id PK
        uuid user_id FK "unique"
        text phone "+1XXXXXXXXXX"
        bool verified
        text verification_code "nullable, cleared after verify"
        timestamptz code_expires_at "nullable"
        timestamptz linked_at "nullable, set on verify"
        timestamptz created_at
    }
```

## Accumulation rules

- **Components**: Max 1 per layer per user (5 total). Upsert replaces existing.
- **Patterns**: Max 2 per layer per user. Same name = replace. 3rd pattern archives oldest to manual_changelog.
- **Unique indexes**: `unique_component_per_layer` (partial, type='component'), `unique_pattern_name_per_layer` (partial, type='pattern').

## The five layers

| Layer | Name |
|-------|------|
| 1 | What Drives You |
| 2 | Your Self Perception |
| 3 | Your Reaction System |
| 4 | How You Operate |
| 5 | Your Relationship to Others |
