# Jove Visual Specification

## Authoritative identity

Use `references/01-model-sheet.png` for anatomy and proportions. Later references show approved modes and poses but must not redefine the character.

## Construction

- Ageless, human-adjacent monoline figure
- Round, slightly organic head
- Compact torso
- Simple expressive arms and legs
- Tiny vertical oval eyes
- Minimal mouth
- Eyebrows appear only when required by the mode
- No nose, cheeks, lashes, pupils, clothing, hair, or accessories

## Line language

- Thin monoline construction
- Rounded line caps and joins
- Slight hand-drawn irregularity
- No filled body shapes
- Character line should be visually stronger than any interface line he interacts with
- Use `currentColor` in the production SVG so Jove follows the app theme
- Production background must remain transparent

Reference-board palette:

- Warm ivory line: approximately `#F2EFE7`
- Dark charcoal field: approximately `#1B1B19`

These are reference values, not instructions to replace the application's design tokens. Codex should use existing theme tokens where available.

## Facial hierarchy

Expression should be communicated approximately through:

- 70% posture
- 20% eye direction and head angle
- 10% mouth

Avoid enlarging facial features to make a mode more legible. At small sizes, simplify before exaggerating.

## Required size tests

The development gallery must show every implemented scene at:

- 32 px
- 48 px
- 72 px
- 120 px
- 180 px

Test on both light and dark surfaces. Stroke weight may require a small-size token rather than one universal value. Decide this from the gallery; do not assume it from the raster sheets.

## Interface interaction

- UI objects are secondary to Jove.
- Jove may sit on, lean against, peek over, climb, push, pull, carry, or connect interface elements.
- UI reference geometry should be rendered by the real UI component when possible, not duplicated inside Jove's SVG.
- Jove must not obscure text, controls, timestamps, focus rings, or selection.
- Prefer component-relative placement over global page coordinates.

## Explicit visual exclusions

- Large or glossy eyes
- Permanent smile
- Baby proportions
- Thick cartoon outlines
- Bright character colors
- Glow, shadow aura, or green perimeter
- Corporate stock-vector polish
- 3D rendering
- Animal traits
- Decorative props unrelated to the interface
- Automatic raster tracing as production SVG
