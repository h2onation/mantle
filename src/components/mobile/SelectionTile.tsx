"use client";

interface SelectionTileProps {
  title: string;
  /** First-order section picks pass a tagline (navy title + sub line).
   *  Second-order focus picks omit it — the phrase reads as body ink. */
  subtitle?: string;
  onSelect: () => void;
  disabled: boolean;
}

/**
 * The unified guided-intake selection tile. One tap selects AND advances — no
 * confirm, no checkmark, no persistent selected state — so the only states are
 * rest / hover / focus-visible / press, all in the `.mw-seltile*` block in
 * globals.css (inline styles can't express those pseudo-states).
 *
 * Shared by SectionPicker (first-order, with a tagline) and QuickReplyChips
 * (second-order focus picks, title only) so the two selection moments are the
 * same control. The tile's radius tracks the Jove bubble and its title rides
 * --font-serif, so it sits in the bubble's family and inherits the dyslexic
 * sans accommodation.
 */
export default function SelectionTile({
  title,
  subtitle,
  onSelect,
  disabled,
}: SelectionTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={subtitle ? "mw-seltile" : "mw-seltile mw-seltile--focus"}
    >
      <span className="mw-seltile-body">
        <span className="mw-seltile-title">{title}</span>
        {subtitle && <span className="mw-seltile-tagline">{subtitle}</span>}
      </span>
      <span className="mw-seltile-chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
