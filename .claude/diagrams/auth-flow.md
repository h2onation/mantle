# User Authentication Flow

## New user (anonymous start)

```mermaid
flowchart TD
    A[User visits /login] --> B[OnboardingFlow: entry screen]
    B --> C["Get Started"]
    C --> D[Info screens x2<br/>swipeable]
    D --> E["Age confirmation + Begin"]
    E --> F["signInAnonymously()"]
    F --> G["Set localStorage flags<br/>(onboarding_completed, age_confirmed)"]
    G --> H["router.push('/')"]
    H --> I["Middleware: getUser() succeeds<br/>(anonymous user is valid)"]
    I --> J[MainApp loads]
    J --> K["Welcome message + 3 chips displayed"]
    K --> L["User taps chip → sendMessage(chipText)"]
    L --> M["First conversation begins"]
```

## Returning user (email/password or Google)

```mermaid
flowchart TD
    A[User visits /login] --> B[OnboardingFlow: entry screen]
    B --> C[Log In]
    C --> D{Auth method?}
    D -- Email --> E["signInWithPassword(email, password)"]
    D -- Google --> F["signInWithOAuth({ provider: 'google' })"]
    F --> G[Google consent screen]
    G --> H[Redirect to /auth/callback]
    H --> I[Exchange code for session]
    E --> J["router.push('/')"]
    I --> J
    J --> K["Middleware: getUser() succeeds"]
    K --> L[MainApp loads with existing data]
```

## Guest-to-real conversion

```mermaid
flowchart TD
    A[Anonymous user confirms first checkpoint] --> B["Backend detects user.is_anonymous"]
    B --> C["SSE returns promptAuth: true"]
    C --> D[AuthPromptModal appears]
    D --> E{Method chosen?}
    E -- Email --> F["updateUser({ email, password })"]
    E -- Google --> G["Set mantle_pending_conversion flag"]
    G --> H["linkIdentity({ provider: 'google' })"]
    H --> I[Google consent screen]
    I --> J[Return to app]
    J --> K["Detect + remove pending_conversion flag"]
    F --> L[Account is now permanent]
    K --> L
```

## Middleware behavior

```mermaid
flowchart LR
    REQ[Incoming request] --> MW[middleware.ts]
    MW --> AUTH["getUser() via server client<br/>(also refreshes session cookies)"]
    AUTH --> CHECK{Authenticated?}
    CHECK -- "No + not /login" --> REDIR1[Redirect to /login]
    CHECK -- "Yes + on /login" --> REDIR2[Redirect to /]
    CHECK -- "Yes + normal page" --> PASS[Continue to page]
    CHECK -- "No + on /login" --> PASS
```

## Three Supabase clients

| Client | Where | Key used | Purpose |
|--------|-------|----------|---------|
| **Admin** | API routes only | Service role key | Bypasses RLS. All DB writes. |
| **Server** | API routes + middleware | Anon key + cookies | Auth verification only (getUser). |
| **Browser** | Client components | Anon key | Client-side auth + data reads through RLS. |
