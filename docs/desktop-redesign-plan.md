# Desktop front-door redesign — living plan

Status: **PROPOSAL — awaiting founder sign-off on direction.** No app code touched yet.
Companion mockup: `mockups/desktop-frontdoor-v1.html` ("The Reading Room").
Model for cadence: `docs/redesign-migration-plan.md` (the mobile redesign).

## The problem

The mobile front door (ADR-047, Phases 0–5) shipped a real Home, a collapsible
icon-emblem Manual, a 5-layer "go deeper" index, and a landing inversion.
Desktop (≥1030px) kept its ADR-046 shell (the Rail + RoomHeader + one capped
center view) and inherited *only* the new colors and fonts. So desktop has the
new **language** but not the new **concepts**. Three concrete gaps:

1. **No Home on desktop.** `MainApp` coerces `home → session` before `DesktopShell`
   sees it (`MainApp.tsx`), and `LAND_ON_HOME` is effectively mobile-only. The
   greeting / resume / 5-layer index moment never appears on desktop.
2. **Mid-width (431–1029px) is broken.** `DesktopVitrine` renders a phone-frame
   on a backdrop; the new bottom nav makes the frame, content, and colophon
   collide. Founder called it "funky."
3. **Guided + Upload are unreachable for returning users** (the drawer that
   exposed them was retired in mobile Phase 2). Inherited by desktop.

## The hard constraint (non-negotiable, from ADR-046)

> An ambient, always-visible self-document during disclosure reads as
> **surveillance** for this population. The Manual must **replace** the
> conversation as a full view — never side-by-side with an active chat.

Every option below respects this. Note the distinction the plan relies on: the
**Manual's entry prose** is the surveillance risk. The **5-layer index** (names,
taglines, counts, "go deeper" cues — no disclosed content) is a *navigation*
surface, the same category as the sidebar's existing "Your Manual" count, which
passed ADR-046 review. The index may live on Home/in the chrome; entry prose may
not sit beside a live chat. (To be pressure-tested by the applied-psychologist
agent before the Home phase ships.)

## Recommended direction — "The Reading Room"

Evolve the ADR-046 Rail; add a real desktop **Home** as a center view; make the
shell responsive down to ~860px and retire the phone-frame vitrine for signed-in
users. Reuse the four shared views and existing data/callbacks — no new state
model, no new data.

### The six design questions (recommendation each — founder decides)

**Q1 — Does desktop get a Home?** → **Yes: a desktop-native Home center-view,
with the landing inversion extended to desktop.**
The mission is to bring the *concepts* natively; Home is the centerpiece concept.
The 276px sidebar cannot do the 5-layer index justice (emblem + name + tagline +
count + go-deeper needs width). A center-view Home at the 720px measure can.
Stop the `home → session` coercion; let `DesktopShell` render a `home` view; apply
`LAND_ON_HOME` on desktop so returning users land on Home (first-run / mid-checkpoint
/ streaming-opener still go straight to the conversation, same guards as mobile).
*Rejected — "no Home, the sidebar is the home":* removal-first but it's "colors
only," loses the greeting/resume warmth, and crams the index into a rail.

**Q2 — Where do the 5-layer index + per-layer "go deeper" live?** → **On Home
(primary entry point); the Manual read view keeps its own per-layer go-deeper
(already shipped from mobile).** Clear division of labor: **Home = the index /
way in; Manual = the read + deepen surface.** Not in the sidebar (too cramped),
not duplicated anywhere else. Reuses `LayerIcon`, `buildLayers`, and the existing
`onExploreWithPersona(ExplorationContext)` callback verbatim.

**Q3 — The mid-width (431–1029px) story.** → **Extend the desktop shell down to
~860px with the sidebar defaulting to the slim rail; retire the phone-frame
vitrine for signed-in users.** 66px rail + 720px measure fits ~860px. Below
~860px, the shipped mobile layout fills the viewport full-bleed (no frame). One
continuous responsive app, phone → wide desktop. The vitrine was always "for now,
pending redesign" (ADR-012, superseded). *Open sub-decision: exact breakpoint
(~860 proposed) and whether the unauthenticated marketing page keeps any vitrine
treatment.*

**Q4 — The sidebar's fate.** → **Keep the Rail (it won ADR-046), restyle to the
new tokens, and slim it to remove overlap with Home.** Top: three nav rows —
**Home · Conversation · Your Manual (count)** — then **New session**, then the
**Sessions** history list (the sidebar is the single source of truth for session
history; Home does *not* repeat a long recent list). Footer unchanged
(Settings/Theme/Crisis/Log out + colophon + admin). The oversized "Your Manual"
card collapses into a clean nav row with a count badge. Collapsed rail keeps
ADR-046 behavior (icons + badges + tooltips), now including a Home icon.

**Q5 — Guided intake + Upload reachability.** → **A three-equal-card "ways to
begin" triptych on Home** (Bring a situation · Guided · Upload — the resume
ribbon is separate, above it). *Correction from the engineering review:* Guided
and Upload are **not** actually broken — they're reachable today from the
new-session empty state (`startConversation("guided-intake" | "upload")`). The
triptych *surfaces* them prominently on Home (a UX win), it doesn't restore a
lost capability, so the wiring is trivial (callbacks already exist).

**Q6 — The scoped "GOING DEEPER · {layer}" bar on desktop.** → **Fold the scoped
context into `RoomHeader`** (it already follows `activeView`; pass it the scoped
label and render "Going deeper · {layer}" as the running title), and suppress
`MobileSession`'s own in-body bar on desktop via a prop, mirroring `showTopBar`.
One clean header instead of header + bar. Mobile stays byte-identical (prop
defaults to showing the bar). *Verify visually first; if the in-body bar already
reads fine under RoomHeader, skip the fold and keep it.*

## Engineering architecture (senior-engineer review, 2026-06-18)

**No duplicated components — shared substance, thin platform shells.**

- `src/lib/hooks/useHomeModel.ts` — one data hook = the single source of truth
  for Home's derived data (greeting, date, resume-thread selection, the 5 layers
  + started count). Both Homes call it; the decision logic exists once (honors the
  HARD BLOCK on duplicated decision logic). Memoize `buildLayers` inside it.
- `src/components/home/LayerIndex.tsx` — one shared 5-layer "go deeper" index,
  driven by `variant: "mobile" | "desktop"` that controls **density only**
  (emblem/padding/type size), never structure. Same `onExploreWithPersona`
  payload from both platforms. Highest-value extraction.
- `src/components/mobile/MobileHome.tsx` — refactored to compose `useHomeModel` +
  `LayerIndex`. Renders **pixel/behavior-identical** on mobile (invisible
  refactor). Keeps its own recents list + situation card.
- `src/components/desktop/DesktopHome.tsx` — new thin layout shell: greeting +
  slim resume ribbon + the 3-equal-card triptych (`WaysToBegin`, desktop-local) +
  `LayerIndex variant="desktop"`. No recents (the sidebar owns history).
- *Rejected — one Home component branching internally on width:* the two Homes
  diverge in *composition* (recents vs triptych), so internal branching becomes a
  thicket of `isDesktop ?` ternaries and crosses the complexity gate.

**Manual — no fork.** `MobileManual` + the `manual/*` primitives already render
through `DesktopShell` today. One real desktop adaptation: the share **half-sheet**
(a phone-style bottom sheet pinned to the viewport) becomes a **centered modal**
on desktop, gated by a prop that defaults to mobile behavior (mobile stays
identical). Safe-area padding and scroll-fade already resolve correctly on desktop.

**Wiring — the load-bearing change is one line.** `LAND_ON_HOME` and its first-run
/ mid-checkpoint / opener-streaming guards *already fire on desktop* — Home was
just hidden by a one-line `home → session` coercion in `MainApp`. Remove that line
+ pass a real `homeContent`/`home` case into `DesktopShell`, and Home appears. The
triptych's Guided/Upload callbacks reuse the existing `startConversation(...)`.

## Phases (each: tsc-clean · senior-reviewed · build-verified · committed · verified at ≥1030px AND mid-width)

- **Phase A — Extract the shared core (invisible refactor).** Create
  `useHomeModel` + `LayerIndex`; refactor `MobileHome` onto them. Nothing new
  appears. **Gate: mobile Home renders identically** (real visual check). Add a
  `useHomeModel` unit test. *Lowest risk to the user, but the easiest to get
  subtly wrong — done isolated so any mobile regression is unambiguously here.*
- **Phase B — Desktop Home + landing.** Build `DesktopHome` (ribbon + triptych +
  `LayerIndex variant="desktop"`); add the `home` view + `homeContent` to
  `DesktopShell`; add Home to `RoomHeader` + `DesktopSidebar`; remove the
  `home → session` coercion so returning desktop users land on Home. **Gate:
  returning user → Home; first-run / mid-checkpoint / opener-streaming →
  conversation.** Pressure-test the index-beside-chrome read with the
  applied-psychologist agent before merge.
- **Phase C — Manual desktop adaptation.** Centered share modal on desktop;
  verify scroll-fade + safe-area. **Gate: mobile Manual identical; desktop sheet
  centered.**
- **Phase D — (separate, later) Mid-width / vitrine retirement (Q3).** Lowering
  the breakpoint + retiring the phone-frame vitrine for authed users changes which
  shell renders for a whole viewport band — higher-risk and orthogonal to
  Home/Manual. **Decoupled from this effort by recommendation; its own review.**
- **Phase E — Scoped header + polish (Q6).** Fold the scoped "Going deeper · layer"
  label into `RoomHeader`; final spacing / focus / hover / keyboard pass.
- **Docs.** New ADR (desktop front door, extending ADR-046/047) + `state.md`
  ship-log.

## Verification note
There are **no component tests** for `MobileHome` / `MobileManual` / `Desktop*` —
only backend tests. The Phase A refactor of a shipped mobile surface has no
automated regression guard, so verification is a **real visual check of mobile
Home before/after** (with screenshot proof), not an assumption. A cheap
`useHomeModel` unit test is worth adding regardless.

## Guardrails carried through every phase

- Do **not** touch the mobile experience (<1030px / the new breakpoint). It shipped.
- Do **not** touch the engine/voice/checkpoint/extraction. UI/layout only.
- Light-first only; dark theme is a later pass.
- Manual entry prose never beside an active chat.
- Inline styles only; colors only via `--session-*` tokens; prefer size tokens.
- Removal-first: reuse the four shared views and existing data; slim before adding.

## Decisions for the founder (direction approved; these shape the build)

1. **Proceed with the A→B→C build** — shared `useHomeModel` + `LayerIndex`,
   refactor `MobileHome` invisibly, new `DesktopHome`, Manual reused as-is?
   (recommend yes)
2. **Decouple mid-width / vitrine retirement (Phase D)** from this effort and do
   it later as its own reviewed phase? (recommend yes — it's higher-risk and
   unrelated to Home/Manual)
3. **Manual share popup on desktop → centered modal** (vs. leaving the phone-style
   bottom sheet)? (recommend centered modal)
