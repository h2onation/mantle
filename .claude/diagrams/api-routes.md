# API Route Map

Overview of all API routes, their runtimes, auth requirements, and data flow.

```mermaid
flowchart TD
    subgraph Public["Public (no auth)"]
        LOGIN["/login page"]
        CALLBACK["GET /auth/callback<br/>OAuth redirect handler"]
    end

    subgraph Authenticated["Authenticated (user)"]
        CHAT["POST /api/chat<br/>Edge — stream Sage response"]
        CONFIRM["POST /api/checkpoint/confirm<br/>Edge — confirm/reject/refine"]
        MANUAL["GET /api/manual<br/>Node — user's manual entries"]
        CONVS["GET /api/conversations<br/>Node — session list"]
        COMPLETE["POST /api/conversations/complete<br/>Edge — mark done + summary"]
        SUMMARY["POST /api/session/summary<br/>Edge — generate summary"]
        LOGOUT["POST /api/auth/logout<br/>Node — clear cookies"]
        DELETE["POST /api/account/delete<br/>Edge — delete everything"]
    end

    subgraph Admin["Admin only"]
        AUSERS["GET /api/admin/users<br/>Node — all users + counts"]
        ACONV["POST /api/admin/conversations<br/>Node — user's conversations"]
        AMSG["POST /api/admin/messages<br/>Node — full message thread"]
    end

    subgraph Dev["Admin only (was dev-only)"]
        DSIM["POST /api/dev-simulate<br/>Edge — run simulated conversation"]
        DRESET["POST /api/dev-reset<br/>Edge — delete user data"]
        DPOP["POST /api/dev-populate<br/>Edge — populate manual"]
        DLOGIN["POST /api/dev-login<br/>Edge — passwordless login"]
    end
```

## Request/response patterns

```mermaid
flowchart LR
    subgraph "SSE Streaming"
        CHAT2["POST /api/chat"] --> SSE["text_delta → message_complete"]
        CONFIRM2["POST /api/checkpoint/confirm"] --> SSE
    end

    subgraph "JSON Response"
        MANUAL2["GET /api/manual"] --> JSON["{ components: [...] }"]
        CONVS2["GET /api/conversations"] --> JSON2["{ conversations: [...] }"]
        USERS2["GET /api/admin/users"] --> JSON3["{ users: [...] }"]
    end

    subgraph "Admin Audit Trail"
        ACONV2["POST /api/admin/conversations"]
        AMSG2["POST /api/admin/messages"]
        ACONV2 --> LOG["Insert to admin_access_logs"]
        AMSG2 --> LOG
    end
```

## Auth verification pattern

Every authenticated route follows:
1. **Server client** calls `getUser()` to verify auth
2. **Admin client** (service role) does all database operations
3. Admin routes additionally call `verifyAdmin()` which checks JWT `app_metadata.role`
