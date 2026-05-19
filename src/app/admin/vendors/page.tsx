"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import {
  VENDORS,
  type Vendor,
  type VendorCategory,
  type VendorStatus,
} from "@/lib/vendors/registry";

// ---------------------------------------------------------------------------
// Vendor inventory — reads from src/lib/vendors/registry.ts (canonical).
//
// Edit the registry to add/remove/update a vendor. This page renders whatever
// is there. Docs link here rather than maintaining a parallel list.
// ---------------------------------------------------------------------------

type FilterKey = "all" | VendorStatus | VendorCategory;

const STATUS_ORDER: VendorStatus[] = ["live", "deprecated", "potential"];

const STATUS_LABEL: Record<VendorStatus, string> = {
  live: "Live",
  deprecated: "Deprecated",
  potential: "Potential",
};

const CATEGORIES: VendorCategory[] = [
  "LLM",
  "Database",
  "Messaging",
  "Speech",
  "Analytics",
  "RateLimit",
  "Infra",
];

const CATEGORY_LABEL: Record<VendorCategory, string> = {
  LLM: "LLM",
  Database: "Database",
  Messaging: "Messaging",
  Speech: "Speech",
  Analytics: "Analytics",
  RateLimit: "Rate limit",
  Infra: "Infra",
};

export default function VendorsPage() {
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return VENDORS;
    if (STATUS_ORDER.includes(filter as VendorStatus)) {
      return VENDORS.filter((v) => v.status === filter);
    }
    return VENDORS.filter((v) => v.category === filter);
  }, [filter]);

  const counts = useMemo(() => {
    const byStatus = new Map<VendorStatus, number>();
    const byCategory = new Map<VendorCategory, number>();
    for (const v of VENDORS) {
      byStatus.set(v.status, (byStatus.get(v.status) ?? 0) + 1);
      byCategory.set(v.category, (byCategory.get(v.category) ?? 0) + 1);
    }
    return { total: VENDORS.length, byStatus, byCategory };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<VendorStatus, Vendor[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const v of filtered) map.get(v.status)?.push(v);
    return map;
  }, [filtered]);

  if (!isAdmin) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        Not authorized.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--session-linen)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error)",
          textAlign: "center",
          padding: "6px 0",
          borderBottom: "1px solid var(--session-error-ghost)",
          background: "var(--session-error-banner)",
          flexShrink: 0,
        }}
      >
        Read Only — Admin
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="vendors" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Header strip */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "18px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "22px",
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--session-ink)",
                letterSpacing: "-0.005em",
              }}
            >
              Vendor inventory
            </div>
            <div
              style={{
                width: 1,
                height: 22,
                background: "var(--session-ink-hairline)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
              }}
            >
              {counts.total} vendors · {counts.byStatus.get("live") ?? 0} live ·{" "}
              {counts.byStatus.get("deprecated") ?? 0} deprecated ·{" "}
              {counts.byStatus.get("potential") ?? 0} potential
            </span>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 32px 80px",
            }}
          >
            <SourceNote />

            <FilterChips
              filter={filter}
              setFilter={setFilter}
              counts={counts}
            />

            {STATUS_ORDER.map((status) => {
              const rows = grouped.get(status) ?? [];
              const hideEmpty = filter !== "all" && filter !== status;
              if (rows.length === 0 && hideEmpty) return null;
              return (
                <StatusGroup
                  key={status}
                  status={status}
                  vendors={rows}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source note — where the data lives, what edits drive
// ---------------------------------------------------------------------------

function SourceNote() {
  return (
    <div
      style={{
        marginBottom: 22,
        padding: "14px 18px",
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-walnut-border-soft)",
        borderRadius: 8,
        fontFamily: "var(--font-spectral, var(--font-serif))",
        fontSize: "14px",
        lineHeight: 1.55,
        color: "var(--session-ink-soft)",
      }}
    >
      Source of truth:{" "}
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12.5px",
          color: "var(--session-ink)",
          background: "var(--session-walnut-surface-soft)",
          padding: "1px 6px",
          borderRadius: 3,
        }}
      >
        src/lib/vendors/registry.ts
      </code>
      . Edit that file to add a vendor, change a status, or note a future
      candidate. Rationale for each choice lives in the linked ADRs (see{" "}
      <a
        href="/admin/docs"
        style={{ color: "var(--session-ink)", textDecoration: "underline" }}
      >
        Docs → decisions
      </a>
      ).
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function FilterChips({
  filter,
  setFilter,
  counts,
}: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  counts: {
    total: number;
    byStatus: Map<VendorStatus, number>;
    byCategory: Map<VendorCategory, number>;
  };
}) {
  const statusChips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    ...STATUS_ORDER.map((s) => ({
      key: s as FilterKey,
      label: STATUS_LABEL[s],
      count: counts.byStatus.get(s) ?? 0,
    })),
  ];

  const categoryChips: { key: FilterKey; label: string; count: number }[] =
    CATEGORIES.map((c) => ({
      key: c as FilterKey,
      label: CATEGORY_LABEL[c],
      count: counts.byCategory.get(c) ?? 0,
    })).filter((c) => c.count > 0);

  return (
    <div style={{ marginBottom: 22 }}>
      <ChipRow label="STATUS" chips={statusChips} filter={filter} setFilter={setFilter} />
      <div style={{ height: 8 }} />
      <ChipRow label="CATEGORY" chips={categoryChips} filter={filter} setFilter={setFilter} />
    </div>
  );
}

function ChipRow({
  label,
  chips,
  filter,
  setFilter,
}: {
  label: string;
  chips: { key: FilterKey; label: string; count: number }[];
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "1.5px",
          color: "var(--session-ink-ghost)",
          marginRight: 4,
          minWidth: 60,
        }}
      >
        {label}
      </span>
      {chips.map((c) => {
        const active = filter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "5px 11px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              letterSpacing: "0.1px",
              color: active ? "var(--session-ink)" : "var(--session-ink-soft)",
              background: active
                ? "var(--session-walnut-highlight)"
                : "var(--session-walnut-tint)",
              border: active
                ? "1px solid var(--session-walnut-border)"
                : "1px solid var(--session-walnut-border-soft)",
              fontWeight: active ? 500 : 400,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{c.label}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--session-ink-ghost)",
                fontWeight: 400,
              }}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status group — section header + vendor rows
// ---------------------------------------------------------------------------

function StatusGroup({
  status,
  vendors,
  expandedId,
  setExpandedId,
}: {
  status: VendorStatus;
  vendors: Vendor[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          {STATUS_LABEL[status]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--session-ink-ghost)",
          }}
        >
          {vendors.length}
        </span>
      </div>

      {vendors.length === 0 ? (
        <EmptyGroup status={status} />
      ) : (
        <div
          style={{
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 8,
            background: "var(--session-walnut-tint)",
            overflow: "hidden",
          }}
        >
          {vendors.map((v, i) => (
            <VendorRow
              key={v.id}
              vendor={v}
              expanded={expandedId === v.id}
              onToggle={() =>
                setExpandedId(expandedId === v.id ? null : v.id)
              }
              isLast={i === vendors.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyGroup({ status }: { status: VendorStatus }) {
  const copy: Record<VendorStatus, string> = {
    live: "No live vendors match this filter.",
    deprecated:
      "No deprecated vendors yet. Move a vendor here when its integration is removed from code.",
    potential:
      "No future candidates listed. Add one in src/lib/vendors/registry.ts to start tracking it.",
  };
  return (
    <div
      style={{
        padding: "18px 16px",
        textAlign: "center",
        fontFamily: "var(--font-spectral, var(--font-serif))",
        fontSize: "13.5px",
        color: "var(--session-ink-ghost)",
        fontStyle: "italic",
        border: "1px dashed var(--session-walnut-border-soft)",
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
      }}
    >
      {copy[status]}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor row — collapsed table-row + expand panel
// ---------------------------------------------------------------------------

function VendorRow({
  vendor,
  expanded,
  onToggle,
  isLast,
}: {
  vendor: Vendor;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--session-walnut-border-soft)",
        background: expanded ? "var(--session-walnut-surface-soft)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "minmax(150px, 1.2fr) minmax(90px, 0.6fr) 2fr auto",
          gap: 14,
          alignItems: "center",
          padding: "14px 16px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Name + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <StatusBadge status={vendor.status} />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14.5px",
              fontWeight: 500,
              color: "var(--session-ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {vendor.name}
          </span>
        </div>

        {/* Category */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11.5px",
            letterSpacing: "0.5px",
            color: "var(--session-ink-soft)",
            textTransform: "uppercase",
          }}
        >
          {CATEGORY_LABEL[vendor.category]}
        </span>

        {/* Purpose */}
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "14px",
            lineHeight: 1.45,
            color: "var(--session-ink-soft)",
          }}
        >
          {vendor.purpose}
        </span>

        {/* Chevron */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {expanded && <VendorDetail vendor={vendor} />}
    </div>
  );
}

function StatusBadge({ status }: { status: VendorStatus }) {
  const styles: Record<
    VendorStatus,
    { bg: string; fg: string; border: string; label: string }
  > = {
    live: {
      bg: "var(--session-persona-muted)",
      fg: "var(--session-persona)",
      border: "var(--session-persona-border)",
      label: "LIVE",
    },
    deprecated: {
      bg: "var(--session-warning-soft)",
      fg: "var(--session-warning)",
      border: "var(--session-warning-soft)",
      label: "DEPRECATED",
    },
    potential: {
      bg: "transparent",
      fg: "var(--session-ink-ghost)",
      border: "var(--session-ink-hairline)",
      label: "POTENTIAL",
    },
  };
  const s = styles[status];
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9.5px",
        letterSpacing: "1.2px",
        fontWeight: 500,
        padding: "2px 6px",
        borderRadius: 3,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        borderStyle: status === "potential" ? "dashed" : "solid",
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Vendor detail panel — full data
// ---------------------------------------------------------------------------

function VendorDetail({ vendor }: { vendor: Vendor }) {
  return (
    <div
      style={{
        padding: "4px 16px 18px 16px",
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
        columnGap: 16,
        rowGap: 10,
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        lineHeight: 1.55,
        color: "var(--session-ink-soft)",
        borderTop: "1px solid var(--session-walnut-border-soft)",
        paddingTop: 14,
      }}
    >
      {vendor.url && (
        <>
          <Label>Homepage</Label>
          <a
            href={vendor.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--session-ink)", textDecoration: "underline" }}
          >
            {vendor.url}
          </a>
        </>
      )}

      {vendor.envVars.length > 0 ? (
        <>
          <Label>Env vars</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {vendor.envVars.map((v) => (
              <code
                key={v}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--session-ink)",
                  background: "var(--session-walnut-surface-soft)",
                  padding: "1px 6px",
                  borderRadius: 3,
                }}
              >
                {v}
              </code>
            ))}
          </div>
        </>
      ) : null}

      {vendor.integrationPaths.length > 0 && (
        <>
          <Label>Code</Label>
          <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
            {vendor.integrationPaths.map((p) => (
              <li key={p} style={{ marginBottom: 3 }}>
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--session-ink)",
                  }}
                >
                  {p}
                </code>
              </li>
            ))}
          </ul>
        </>
      )}

      {vendor.webhookPath && (
        <>
          <Label>Webhook</Label>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--session-ink)",
            }}
          >
            POST {vendor.webhookPath}
          </code>
        </>
      )}

      {vendor.featureFlag && (
        <>
          <Label>Feature flag</Label>
          <span style={{ color: "var(--session-ink)" }}>{vendor.featureFlag}</span>
        </>
      )}

      {vendor.adrRefs.length > 0 && (
        <>
          <Label>ADRs</Label>
          <span>
            {vendor.adrRefs.map((n, i) => (
              <span key={n}>
                <a
                  href="/admin/docs"
                  style={{
                    color: "var(--session-ink)",
                    textDecoration: "underline",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12.5px",
                  }}
                >
                  ADR-{String(n).padStart(3, "0")}
                </a>
                {i < vendor.adrRefs.length - 1 ? ", " : ""}
              </span>
            ))}
          </span>
        </>
      )}

      {vendor.notes && (
        <>
          <Label>Notes</Label>
          <span style={{ color: "var(--session-ink)" }}>{vendor.notes}</span>
        </>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "var(--session-ink-ghost)",
        paddingTop: 2,
      }}
    >
      {children}
    </span>
  );
}
