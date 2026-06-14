# Walnut-brain icon

The app icon and favicon are vectorized from Jeff's own walnut-brain logo
(`source-original.png`) — a walnut shell with the kernel drawn as a brain in
negative space. Confirmed owned by mywalnut, Inc. (2026-06-13).

Pipeline: `source-original.png` → traced to clean vector with node-potrace →
shell recolored to walnut `#AA7852`, kernel filled cream `#F4EDE0` so it stays
solid on any background.

Two optical sizes (standard favicon practice):
- Large icons (192/512, apple-touch) use the FULL detailed brain.
- The favicon (16/32/48) uses a SIMPLIFIED variant — at 16px (256 total pixels)
  the fine fold-lines smear into mush, so they're merged into bold lobes. This is
  a faithful simplification of the same brain, not a redraw: the source brain
  region is morphologically "closed" (Gaussian blur + threshold) so the thin sulci
  merge away, leaving the shell ring + a solid lobed kernel blob, then re-traced.

Masters:
- `source-original.png` — Jeff's original raster logo (the trace source)
- `walnut-brain-mark.svg` — traced vector, walnut shell + transparent kernel
- `icon-standalone.svg` — mark with cream kernel backing, transparent tile
- `favicon-small-mark.svg` — simplified blob variant (favicon 16/32/48 source)
- `icon-dark-tile.svg` — mark on the dark graphite rounded tile (app icon 192/512)
- `icon-fullbleed.svg` — mark on full-bleed dark (maskable + apple-touch source)
- `options.html` — self-contained review sheet (images baked in)
- `favicon-fix.html` — before/after of the small-size blur fix

Shipped sizes:
- `src/app/favicon.ico` — 16/32/48 from the simplified blob (`favicon-small-mark.svg`)
- `public/icons/icon-192.png`, `icon-512.png` — dark rounded tile, full detail
- `public/icons/icon-maskable-192.png`, `icon-maskable-512.png` — full-bleed; the
  mark sits at ~73% width, inside the 80% maskable safe zone
- `public/apple-touch-icon.png` — 180, full-bleed (Apple applies its own rounding)

Regenerate: large icons `node /tmp/walnut-icons/prod.js`; simplified favicon
`node /tmp/walnut-icons/trace-blob.js` (sharp + potrace). The simplified blob is
tuned by blur sigma (~14) and threshold (~182). The ICO is three PNGs (16/32/48)
in an ICO container.
