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
// by Jove (the old ---chips--- marker was retired 2026-07-08). "Explore this
// thread more deeply" spins a fresh session seeded with the just-saved entry
// (useChat.keepWorkingFromSave); "Discuss a different situation" starts fresh;
// "Take a break" closes warmly. Same SelectionTile visual as the section
// picker, so the selection moments read as one control.
const ITEMS = [
  { key: "new", title: "Discuss a different situation", value: "new" },
  { key: "keep", title: "Explore this thread more deeply", value: "keep" },
  { key: "break", title: "Take a break", value: "break" },
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
