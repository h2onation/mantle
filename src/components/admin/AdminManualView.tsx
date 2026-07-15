"use client";

import { useEffect, useState } from "react";
import type { ManualEntry } from "@/lib/types";
import { buildModuleGroups } from "@/components/mobile/manual/layer-definitions";
import type { HomeModule } from "@/lib/modules";
import PopulatedLayer from "@/components/mobile/manual/PopulatedLayer";
import EmptyLayer from "@/components/mobile/manual/EmptyLayer";

export default function AdminManualView({
  entries,
}: {
  entries: ManualEntry[];
}) {
  // The grouping structure — the modules table, fetched once (admin-only
  // surface; the same source /admin/modules edits).
  const [modules, setModules] = useState<HomeModule[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/modules")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.modules)) setModules(d.modules);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const layers = buildModuleGroups(modules, entries);
  const populatedLayers = layers.filter((l) => l.entries.length > 0);
  const emptyLayers = layers.filter((l) => l.entries.length === 0);
  const isEmpty = populatedLayers.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink-mid)",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        No manual entries yet
      </div>
    );
  }

  return (
    // Flex column with gap — each Plate's tab pip protrudes from its
    // top edge, so subsequent Plates need vertical clearance above
    // their box. The `gap` provides it; padding-top gives the first
    // Plate's pip room within the parent.
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-md)",
        paddingTop: 18,
      }}
    >
      {populatedLayers.map((layer) => (
        <PopulatedLayer key={layer.slug} layer={layer} readOnly />
      ))}
      {emptyLayers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              margin: "8px 0 0",
            }}
          >
            UPCOMING
          </div>
          {emptyLayers.map((layer) => (
            <EmptyLayer key={layer.slug} layer={layer} readOnly />
          ))}
        </>
      )}
    </div>
  );
}
