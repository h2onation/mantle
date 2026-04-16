# Service Worker audit — 2026-04-17

Track 3 of `docs/checkpoint-hardening-plan.md` called for a service worker audit to confirm `/api/*` requests are not intercepted by the SW. The `(failed) net::ERR_` row initiated by `sw.js:69` that appeared in DevTools during the 2026-04-16 debugging session looked suspicious, but turned out to be unrelated to the checkpoint confirm bug.

## Handler-by-handler

`public/sw.js` (93 lines total). Each handler:

| Predicate (order matters) | Strategy | Source lines | Notes |
|---|---|---|---|
| Different origin | No intercept | 43 | SW only handles same-origin |
| `/api/*` or `/auth/*` | **Network-only (no intercept)** | 46-48 | Early return, browser handles natively. **Safe.** |
| RSC request (header `RSC: 1`) | **Network-only** | 49-51 | Next.js React Server Components must never be cached |
| `/_next/static/*` | Stale-while-revalidate | 54-57 | Content-hashed assets, safe to cache |
| Navigation request (`mode === 'navigate'`) | Network-first with `/offline.html` fallback | 60-65 | The `.catch()` returns offline page on fetch failure — this is where the `(failed) net::ERR_` row comes from. Behaviour is correct. |
| Everything else (same-origin GET/POST) | Network-first, cache on 200 GET | 67-80 | Line 69 is the fetch() inside this block. On failure, returns cached response if any. |

## Conclusion

- `/api/checkpoint/confirm` and every other `/api/*` route is **not** intercepted. The browser fetches them directly. The SW cannot cause confirm failures, duplicate requests, or stale responses on API calls.
- Yesterday's `(failed) net::ERR_` at `sw.js:69` was the navigation fallback kicking in on a page load (likely a transient network blip between SW install and the first live page request). It does not affect API calls.
- No changes needed to `public/sw.js`.

## What DevTools labels as `sw.js:69`

DevTools attributes the network row to `sw.js:69` because the fetch was initiated from that line in the service worker (the fallthrough `fetch(event.request)` inside the "everything else" block). The initiator being sw.js does NOT mean the SW served or cached that particular response — in this code it means the SW started the fetch, saw it fail, and fell back to cache or the offline page.

## Follow-ups (not blocking)

- **Cache versioning on deploy**: `PRECACHE = 'mw-precache-v1'` and `RUNTIME = 'mw-runtime-v1'` are hardcoded. A future change to cached static paths would need a version bump to invalidate old clients. Worth considering a build-time version injection, but not urgent.
- **Offline page**: the PRECACHE includes only `/offline.html`. A user visiting offline on their first-ever visit (before install) sees nothing useful. Out of scope for Track 3.
