# Walnut-brain icon

The app icon and favicon are derived from the Noto Emoji brain (U+1F9E0),
© Google, licensed under Apache License 2.0 (https://github.com/googlefonts/noto-emoji).
Recolored from the original pink ramp to mywalnut's walnut browns.

Files:
- `noto-brain.svg` — unmodified source artwork
- `walnut-brain.svg` — recolored master (pink ramp → walnut ramp)
- `brain-alone.svg` — standalone mark, transparent (favicon.ico 16/32/48)
- `brain-tile-rounded.svg` — dark rounded tile (public/icons/icon-192/512)
- `brain-tile-fullbleed.svg` — full-bleed square (apple-touch-icon)
- `brain-tile-maskable.svg` — full-bleed, mark in 80% safe zone (maskable icons)
- `preview.html` — self-contained visual proof sheet (images baked in)

Color mapping: #FFB3B3→#EFCD9E · #F07371→#C08B57 · #EA6363→#B37E4B · #E06767→#A8743F · #B05353→#7E5226

To regenerate sizes: `npx sharp-cli -i <master>.svg -o out.png resize N N`.
The ICO is three PNGs (16/32/48) wrapped in an ICO container.
