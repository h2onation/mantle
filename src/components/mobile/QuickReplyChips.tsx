"use client";

import SelectionTile from "./SelectionTile";

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled: boolean;
}

/**
 * Second-order focus picks (and any structural `---chips---` choice Jove
 * emits) render as the SAME SelectionTile as the section picker — one tap
 * selects and advances. Title-only (no tagline), so the phrase reads in body
 * ink. Keeping the {chips,onSelect,disabled} contract means MobileSession's
 * call site is unchanged; only the visual is unified with the section picker.
 */
export default function QuickReplyChips({
  chips,
  onSelect,
  disabled,
}: QuickReplyChipsProps) {
  return (
    <div className="mw-seltile-group">
      {chips.map((chip) => (
        <SelectionTile
          key={chip}
          title={chip}
          onSelect={() => onSelect(chip)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
