"use client";

import { LAYERS } from "@/lib/manual/layers";
import SelectionTile from "./SelectionTile";

interface SectionPickerProps {
  onSelect: (sectionName: string) => void;
  disabled: boolean;
}

/**
 * The guided-intake section picker. Renders the five canonical Manual sections
 * (from layers.ts — the single source of truth, so the names can't drift) as
 * SelectionTiles (title + tagline). Shown under the tee-up turn when the prompt
 * emits the ---sections--- marker.
 *
 * A tap routes through `sendChipResponse`, so the selection reaches the prompt
 * as a marked `[selected from options] <section name>` message — exactly like a
 * focus pick, no separate selection pathway. Both pickers render the same
 * SelectionTile, so the first- and second-order moments are one control.
 */
export default function SectionPicker({ onSelect, disabled }: SectionPickerProps) {
  return (
    <div className="mw-seltile-group">
      {LAYERS.map((layer) => (
        <SelectionTile
          key={layer.slug}
          title={layer.name}
          subtitle={layer.tagline}
          onSelect={() => onSelect(layer.name)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
