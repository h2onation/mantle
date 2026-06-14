# Walnut-brain icon

The app icon and favicon are vectorized from Jeff's own walnut-brain logo
(`source-original.png`) — a walnut shell with the kernel drawn as a brain in
negative space. Confirmed owned by mywalnut, Inc. (2026-06-14).

Pipeline: `source-original.png` → traced to clean vector with node-potrace →
shell recolored to walnut `#AA7852`, kernel filled cream `#F4EDE0` so it stays
solid on any background.

The source is a high-resolution, bold rendition (790×806) — clean enough that a
single traced master serves every size, including the 16px favicon, with no
separate simplified variant needed. (An earlier low-res source had to be
morphologically simplified for tiny sizes; this one doesn't.)

Masters:
- `source-original.png` — Jeff's original raster logo (the trace source)
- `walnut-brain-mark.svg` — traced vector, walnut shell + cream kernel, transparent tile
- `icon-standalone.svg` — same standalone mark (favicon source)
- `icon-dark-tile.svg` — mark on the dark graphite rounded tile (app icon 192/512)
- `icon-fullbleed.svg` — mark on full-bleed dark (maskable + apple-touch source)
- `options.html` — self-contained review sheet (images baked in)

Shipped sizes (all from the one trace):
- `src/app/favicon.ico` — 16/32/48 from the standalone mark
- `public/icons/icon-192.png`, `icon-512.png` — dark rounded tile
- `public/icons/icon-maskable-192.png`, `icon-maskable-512.png` — full-bleed; the
  mark sits at ~73% width, inside the 80% maskable safe zone
- `public/apple-touch-icon.png` — 180, full-bleed (Apple applies its own rounding)

Regenerate: `node /tmp/walnut-icons/trace2.js` then `node /tmp/walnut-icons/prod2.js`
(sharp + potrace). The ICO is three PNGs (16/32/48) in an ICO container.
