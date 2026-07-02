"use client";

import { SelectionTileGroup } from "./SelectionTile";

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled: boolean;
}

/**
 * Second-order focus picks (and any structural `---chips---` choice Jove
 * emits) render as the SAME SelectionTile as the section picker — one tap
 * selects and advances, staged by SelectionTileGroup (chosen tile prints,
 * siblings vanish). Title-only (no tagline), so the phrase reads in body
 * ink. Keeping the {chips,onSelect,disabled} contract means MobileSession's
 * call site is unchanged; only the visual is unified with the section picker.
 */
export default function QuickReplyChips({
  chips,
  onSelect,
  disabled,
}: QuickReplyChipsProps) {
  return (
    <SelectionTileGroup
      items={chips.map((chip) => ({ key: chip, title: chip, value: chip }))}
      onSelect={onSelect}
      disabled={disabled}
    />
  );
}
