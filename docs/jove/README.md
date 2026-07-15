# Jove V1 — Codex Implementation Package

This package is the approved source of truth for implementing Jove in the mywalnut application.

Jove is a restrained monoline mascot who treats the interface as a physical world. He observes, investigates, connects, waits, and settles. He adds presence and subtle whimsy without becoming childish, distracting, or evaluative.

## Status

The design-definition phase for V1 is complete.

Approved references:

1. `references/01-model-sheet.png` — authoritative anatomy and proportions.
2. `references/02-expression-modes.png` — approved emotional and behavioral modes.
3. `references/03-core-poses.png` — approved physical vocabulary.
4. `references/04-chat-interactions.png` — approved first contextual scenes.

If references conflict, use the earlier-numbered file for character identity and the later-numbered file only for its intended expression, pose, or scene.

The generated raster images are design references. They must not be embedded, traced automatically, or animated directly in production. Recreate Jove as original inline SVG using the written rules in this package.

## Documents

- `character-bible.md` — who Jove is and is not.
- `visual-spec.md` — visual construction rules.
- `motion-spec.md` — movement language and accessibility rules.
- `scene-manifest.md` — approved scene names and intended use.
- `implementation-contract.md` — technical boundaries for V1.
- `codex-start-prompt.md` — the first prompt to run in the app repository.

## Implementation order

1. Place this whole folder at `docs/jove/` in the application repository.
2. Run `codex-start-prompt.md` in Codex Plan mode.
3. Review Codex's inspection report before authorizing edits.
4. Build one static neutral SVG and a development gallery.
5. Approve visual fidelity at multiple sizes.
6. Add approved expressions and poses.
7. Integrate one chat scene only.
8. Expand only after the first integration is visually and technically sound.

Do not generate more character art during initial implementation. The next unresolved work is translating the approved system into SVG and testing it inside the real interface.
