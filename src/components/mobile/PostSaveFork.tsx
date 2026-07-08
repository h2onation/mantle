"use client";

import { SelectionTileGroup } from "./SelectionTile";

interface PostSaveForkProps {
  onKeepWorking: () => void;
  onBringNew: () => void;
  onTakeBreak: () => void;
  disabled: boolean;
}

// The post-save fork. One session builds one reflection, so after a save the
// arc is complete and the client offers three ways forward — it is NOT emitted
// by Jove (the old ---chips--- marker was retired 2026-07-08). "Keep working on
// this" spins a fresh session seeded with the just-saved entry
// (useChat.keepWorkingFromSave); "Bring something new" starts fresh; "That's
// enough for today" closes warmly. Same SelectionTile visual as the section
// picker, so the selection moments read as one control.
const ITEMS = [
  { key: "keep", title: "Keep working on this", value: "keep" },
  { key: "new", title: "Bring something new", value: "new" },
  { key: "break", title: "That’s enough for today", value: "break" },
];

export default function PostSaveFork({
  onKeepWorking,
  onBringNew,
  onTakeBreak,
  disabled,
}: PostSaveForkProps) {
  return (
    <SelectionTileGroup
      items={ITEMS}
      disabled={disabled}
      onSelect={(value) => {
        if (value === "keep") onKeepWorking();
        else if (value === "new") onBringNew();
        else onTakeBreak();
      }}
    />
  );
}
