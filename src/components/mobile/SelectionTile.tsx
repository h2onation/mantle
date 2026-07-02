"use client";

import { useRef, useState } from "react";

interface SelectionTileProps {
  title: string;
  /** First-order section picks pass a tagline (title + sub line).
   *  Second-order focus picks omit it — the phrase reads as body ink. */
  subtitle?: string;
  onSelect: () => void;
  disabled: boolean;
  /** Set by SelectionTileGroup while a sibling's print moment plays. */
  vanished?: boolean;
  /** Set by SelectionTileGroup on the chosen tile during its print moment. */
  printed?: boolean;
}

/**
 * The unified guided-intake selection tile — "the handoff" treatment. Each
 * tile wears the user's own sent-bubble shape (same radius + top-right tail
 * as Bubble's USER_STYLE) as a blind emboss: unprinted paper relief at rest,
 * Jove's navy blooming from the tail corner on hover, and the user-bubble
 * fill "printing" on press — tapping converts Jove's offer into your words.
 * One tap selects AND advances — no confirm, no persistent selected state.
 * All visual states live in the `.mw-seltile*` block in globals.css.
 *
 * Shared by SectionPicker (first-order, with a tagline) and QuickReplyChips
 * (second-order focus picks, title only) via SelectionTileGroup below, so
 * the two selection moments are the same control.
 */
export default function SelectionTile({
  title,
  subtitle,
  onSelect,
  disabled,
  vanished = false,
  printed = false,
}: SelectionTileProps) {
  const className = [
    "mw-seltile",
    subtitle ? "" : "mw-seltile--focus",
    printed ? "mw-seltile--printed" : "",
    vanished ? "mw-seltile--vanish" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      onClick={onSelect}
      // Keep the composer's caret put. A real mouse click on a button pulls
      // DOM focus off the textarea onto this button; the tile then unmounts
      // (the picker hides while Jove replies), so focus falls to <body> and
      // the next keystrokes land nowhere — the desktop "can't type after
      // selecting" bug. preventDefault on mousedown suppresses the focus
      // transfer without touching the click, so focus never leaves the
      // composer. Mouse-path only: keyboard Enter/Space activation and the
      // press/focus-visible states are unaffected.
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      className={className}
    >
      <span className="mw-seltile-body">
        <span className="mw-seltile-title">{title}</span>
        {subtitle && <span className="mw-seltile-tagline">{subtitle}</span>}
      </span>
    </button>
  );
}

export interface SelectionTileItem {
  key: string;
  title: string;
  subtitle?: string;
  /** The value handed to onSelect — usually the title/phrase itself. */
  value: string;
}

/** How long the chosen tile's printed state shows (and the siblings' vanish
 *  plays) before onSelect fires and the turn starts. Kept tight so it reads
 *  as "sent," not lag. */
const PRINT_MS = 260;

/**
 * The one owner of the select-and-advance staging: on tap the chosen tile
 * "prints" (user-bubble fill), its siblings vanish, and onSelect fires after
 * the beat — the group unmounts when the turn's isLoading flips. Both pickers
 * render through this so the staging logic exists exactly once.
 */
export function SelectionTileGroup({
  items,
  onSelect,
  disabled,
}: {
  items: SelectionTileItem[];
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const firedRef = useRef(false);

  function choose(item: SelectionTileItem) {
    // First tap wins; re-taps and sibling taps during the print beat no-op.
    if (firedRef.current || disabled) return;
    firedRef.current = true;
    setChosenKey(item.key);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onSelect(item.value), reduceMotion ? 0 : PRINT_MS);
  }

  return (
    <div className="mw-seltile-group">
      {items.map((item) => (
        <SelectionTile
          key={item.key}
          title={item.title}
          subtitle={item.subtitle}
          onSelect={() => choose(item)}
          disabled={disabled}
          printed={chosenKey === item.key}
          vanished={chosenKey !== null && chosenKey !== item.key}
        />
      ))}
    </div>
  );
}
