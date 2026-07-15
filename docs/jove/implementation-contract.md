# Jove V1 Implementation Contract

## Goal

Translate the approved Jove system into a lightweight, accessible, responsive component that fits the existing mywalnut architecture.

## Required implementation characteristics

- Original inline SVG; do not embed the raster references.
- TypeScript and existing Next.js conventions.
- Stable viewBox and responsive size prop.
- `currentColor` for theme integration.
- Rounded SVG caps and joins.
- Decorative by default: `aria-hidden`, `focusable="false"`, and `pointer-events: none`.
- Scene-specific SVG compositions are acceptable.
- Existing styling and animation tools should be reused.
- Deterministic application state selects the scene.
- No AI model chooses Jove's pose or expression.

## Minimal component shape

The final API may follow repository conventions, but should remain approximately this small:

```tsx
<Jove
  scene="chat-response-think"
  size={64}
  motion="normal"
/>
```

Use a small component-relative anchor abstraction only if the real integration requires it:

```tsx
<JoveAnchor position="top-right">
  <Jove scene="chat-response-think" size={64} />
</JoveAnchor>
```

## Architecture boundaries

Do not add in V1:

- Backend tables or persisted mascot state
- LLM-controlled animation selection
- Global coordinate tracking
- A universal skeletal or SVG-morphing engine
- Canvas rendering
- Rive, Lottie, or another dependency unless already established in the repository
- Portal-based roaming between components
- A feature-flag service
- Customization or multiple mascots

## Integration boundaries

- Jove must not change chat requests, streaming, persistence, Manual logic, authentication, or analytics semantics.
- Jove must not delay content rendering.
- Jove must not create layout shift.
- Jove must not cover content or controls.
- On constrained mobile layouts, reduce size or hide Jove rather than obstruct the interface.
- Use the application's existing feature-flag pattern if available; otherwise prefer a simple local prop-based opt-in.

## Completion gates

1. Repository architecture inspected with no edits.
2. Static neutral Jove approved at all target sizes.
3. Modes and poses approved in a development gallery.
4. One chat scene integrated without data-flow changes.
5. Reduced motion, mobile placement, lint, types, tests, and production build verified.
6. Diff reviewed before expansion.
