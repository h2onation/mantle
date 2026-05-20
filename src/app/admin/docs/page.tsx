"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Docs — the canonical reference shelf. Renders the five docs from /docs/
// plus a navigator for the 37+ ADRs inside decisions.md. Companion to the
// walkthrough pages (How Jove works → prompt architecture / extraction /
// schema) — those are the tour; this is the reference.
// ---------------------------------------------------------------------------

interface DocFile {
  name: string;
  filename: string;
  lastModified: string;
  content: string;
}

interface DocMeta {
  name: string;
  filename: string;
  title: string;
  oneLine: string;
  audience: string;
}

const DOC_ORDER = ["claude", "intent", "system", "rules", "state", "decisions"] as const;

const DOC_META: Record<string, DocMeta> = {
  claude: {
    name: "claude",
    filename: "CLAUDE.md",
    title: "Working agreements",
    oneLine:
      "How to collaborate in this repo — hard rules, security rules, terminology, command shortcuts. Read first.",
    audience: "You + Claude Code agents",
  },
  intent: {
    name: "intent",
    filename: "intent.md",
    title: "Product hypothesis",
    oneLine: "What we're building and why. North-star reference.",
    audience: "You + Claude Code agents",
  },
  system: {
    name: "system",
    filename: "system.md",
    title: "How the system works",
    oneLine: "Architecture, schema, runtime constraints, hand-offs.",
    audience: "You + Claude Code agents",
  },
  rules: {
    name: "rules",
    filename: "rules.md",
    title: "Rules + conventions",
    oneLine: "Voice principles, UI rules, dead features, guardrails.",
    audience: "You + Claude Code agents",
  },
  state: {
    name: "state",
    filename: "state.md",
    title: "Current state",
    oneLine: "What's deployed, what's in flight, what's broken. Ship log.",
    audience: "You + Claude Code agents",
  },
  decisions: {
    name: "decisions",
    filename: "decisions.md",
    title: "Decision log",
    oneLine: "Why things are the way they are. ADR-format rationale.",
    audience: "You + Claude Code agents",
  },
};

// Staleness thresholds (days)
const STALE_FRESH = 7;
const STALE_AGING = 30;

type Staleness = "fresh" | "aging" | "stale";

function stalenessFor(iso: string): Staleness {
  const days = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= STALE_FRESH) return "fresh";
  if (days <= STALE_AGING) return "aging";
  return "stale";
}

function daysAgo(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

const STALENESS_COLOR: Record<Staleness, { fg: string; bg: string }> = {
  fresh: {
    fg: "var(--session-persona)",
    bg: "var(--session-persona-muted)",
  },
  aging: {
    fg: "var(--session-walnut-meta-strong)",
    bg: "var(--session-walnut-surface-soft)",
  },
  stale: {
    fg: "var(--session-warning)",
    bg: "var(--session-warning-soft)",
  },
};

// ---------------------------------------------------------------------------
// ADR parsing — extracts every ADR-NNN heading from decisions.md and slices
// the content between consecutive headings. Status is parsed from the
// heading (parens) or a "Status:" line in the body.
// ---------------------------------------------------------------------------

interface AdrEntry {
  number: number;
  title: string;
  status: AdrStatus;
  content: string;
}

type AdrStatus = "active" | "reversed" | "superseded" | "amended";

function parseStatusFromHeading(heading: string): AdrStatus {
  const lower = heading.toLowerCase();
  if (lower.includes("(reversed")) return "reversed";
  if (lower.includes("(superseded")) return "superseded";
  if (lower.includes("(amended")) return "amended";
  return "active";
}

function parseAdrs(decisionsMd: string): AdrEntry[] {
  const lines = decisionsMd.split("\n");
  const headingRe = /^(#{2,3})\s+ADR-(\d+)\b(.*?)$/;

  const heads: { idx: number; depth: number; number: number; raw: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(headingRe);
    if (m) {
      heads.push({
        idx: i,
        depth: m[1].length,
        number: parseInt(m[2], 10),
        raw: line,
      });
    }
  });

  const entries: AdrEntry[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const nextIdx = i + 1 < heads.length ? heads[i + 1].idx : lines.length;

    // Parse title from heading
    const titleMatch = h.raw.match(/^#{2,3}\s+ADR-\d+\s*(?:\([^)]*\))?\s*:?\s*(.+?)$/);
    const title = (titleMatch?.[1] ?? `ADR-${h.number}`).trim();

    // Body content between this heading and the next
    const body = lines.slice(h.idx, nextIdx).join("\n").trim();

    // Parse status: first from heading, then look for a "Status:" line in body
    let status = parseStatusFromHeading(h.raw);
    if (status === "active") {
      const statusLine = body.match(/^\*?\*?Status\*?\*?:?\s*(\w+)/im);
      if (statusLine) {
        const s = statusLine[1].toLowerCase();
        if (s === "reversed") status = "reversed";
        else if (s === "superseded") status = "superseded";
        else if (s === "amended") status = "amended";
      }
    }

    entries.push({
      number: h.number,
      title: title.replace(/^\(.*?\)\s*:?\s*/, ""), // strip leading "(REVERSED): " if present
      status,
      content: body,
    });
  }

  // Sort ascending by number
  entries.sort((a, b) => a.number - b.number);
  return entries;
}

const ADR_STATUS_LABEL: Record<AdrStatus, string> = {
  active: "Active",
  reversed: "Reversed",
  superseded: "Superseded",
  amended: "Amended",
};

const ADR_STATUS_COLOR: Record<AdrStatus, { fg: string; bg: string; border: string }> = {
  active: {
    fg: "var(--session-persona)",
    bg: "var(--session-persona-muted)",
    border: "var(--session-persona-border)",
  },
  reversed: {
    fg: "var(--session-error)",
    bg: "var(--session-error-ghost)",
    border: "var(--session-error-ghost)",
  },
  superseded: {
    fg: "var(--session-ink-ghost)",
    bg: "var(--session-walnut-tint)",
    border: "var(--session-walnut-border-soft)",
  },
  amended: {
    fg: "var(--session-warning)",
    bg: "var(--session-warning-soft)",
    border: "var(--session-warning-soft)",
  },
};

// ---------------------------------------------------------------------------
// Selection model
// ---------------------------------------------------------------------------

type Selection =
  | { kind: "doc"; name: string }
  | { kind: "adr"; number: number };

const DEFAULT_SELECTION: Selection = { kind: "doc", name: "state" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDocsPage() {
  const isAdmin = useIsAdmin();
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const [loading, setLoading] = useState(true);
  const [adrStatusFilter, setAdrStatusFilter] = useState<"all" | AdrStatus>("all");

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/docs");
        if (!res.ok) {
          throw new Error(`fetch failed: ${res.status}`);
        }
        const json = await res.json();
        const sorted: DocFile[] = (json.docs || []).sort(
          (a: DocFile, b: DocFile) =>
            DOC_ORDER.indexOf(a.name as (typeof DOC_ORDER)[number]) -
            DOC_ORDER.indexOf(b.name as (typeof DOC_ORDER)[number]),
        );
        if (!cancelled) setDocs(sorted);
      } catch (err) {
        console.error("[admin/docs] load failed", err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const docByName = useMemo(() => {
    const map = new Map<string, DocFile>();
    for (const d of docs) map.set(d.name, d);
    return map;
  }, [docs]);

  const decisionsDoc = docByName.get("decisions");
  const adrs = useMemo(
    () => (decisionsDoc ? parseAdrs(decisionsDoc.content) : []),
    [decisionsDoc],
  );

  const filteredAdrs = useMemo(
    () =>
      adrStatusFilter === "all"
        ? adrs
        : adrs.filter((a) => a.status === adrStatusFilter),
    [adrs, adrStatusFilter],
  );

  const adrStatusCounts = useMemo(() => {
    const counts: Record<AdrStatus, number> = {
      active: 0,
      reversed: 0,
      superseded: 0,
      amended: 0,
    };
    for (const a of adrs) counts[a.status]++;
    return counts;
  }, [adrs]);

  const mostRecentUpdate = useMemo(() => {
    if (docs.length === 0) return null;
    return docs.reduce(
      (latest, d) =>
        new Date(d.lastModified) > new Date(latest) ? d.lastModified : latest,
      docs[0].lastModified,
    );
  }, [docs]);

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
        <AdminNavRail activeId="docs" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Header
            docCount={docs.length}
            adrCount={adrs.length}
            mostRecentUpdate={mostRecentUpdate}
          />

          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1.55fr",
              gap: 32,
              padding: "28px 32px",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowY: "auto", paddingRight: 12 }}>
              {loading ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--session-ink-ghost)",
                    padding: 16,
                  }}
                >
                  Loading…
                </div>
              ) : loadError ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "var(--session-error-banner)",
                    border: "1px solid var(--session-error-ghost)",
                    fontFamily: "var(--font-spectral, var(--font-serif))",
                    fontSize: 14,
                    color: "var(--session-error-text)",
                    lineHeight: 1.55,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "var(--session-error)",
                      marginBottom: 6,
                    }}
                  >
                    Failed to load docs
                  </div>
                  <div style={{ color: "var(--session-ink-soft)" }}>
                    {loadError}. The API endpoint at{" "}
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--session-ink)",
                        background: "var(--session-walnut-surface-soft)",
                        padding: "1px 6px",
                        borderRadius: 3,
                      }}
                    >
                      /api/admin/docs
                    </code>{" "}
                    didn&rsquo;t respond cleanly. Try refreshing; if it
                    persists, check the deployment logs.
                  </div>
                </div>
              ) : (
                <>
                  <DocCards
                    docs={docs}
                    selection={selection}
                    onSelect={setSelection}
                  />
                  <AdrNavigator
                    adrs={filteredAdrs}
                    counts={adrStatusCounts}
                    filter={adrStatusFilter}
                    setFilter={setAdrStatusFilter}
                    selection={selection}
                    onSelect={setSelection}
                  />
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <Reader
                selection={selection}
                docs={docs}
                adrs={adrs}
                onBackToDecisions={() =>
                  setSelection({ kind: "doc", name: "decisions" })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <DocMarkdownStyles />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  docCount,
  adrCount,
  mostRecentUpdate,
}: {
  docCount: number;
  adrCount: number;
  mostRecentUpdate: string | null;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--session-ink-hairline)",
        padding: "18px 32px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Reference
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 28,
            fontWeight: 400,
            fontStyle: "italic",
            color: "var(--session-ink)",
            letterSpacing: "-0.005em",
          }}
        >
          Documentation
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
          }}
        >
          {docCount} docs · {adrCount} ADRs
          {mostRecentUpdate && ` · last updated ${daysAgo(mostRecentUpdate)}`}
        </span>
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 820,
        }}
      >
        Surfaced from the repo — five files in{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--session-ink)", background: "var(--session-walnut-surface-soft)", padding: "1px 6px", borderRadius: 3 }}>docs/</code>{" "}
        plus{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--session-ink)", background: "var(--session-walnut-surface-soft)", padding: "1px 6px", borderRadius: 3 }}>CLAUDE.md</code>{" "}
        at the root. Editing those files (via PR or directly) is how this page changes. For an orientation tour, start at <em>How Jove works</em>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc cards
// ---------------------------------------------------------------------------

function DocCards({
  docs,
  selection,
  onSelect,
}: {
  docs: DocFile[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Core docs
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {docs.map((d) => {
          const meta = DOC_META[d.name];
          if (!meta) return null;
          const selected = selection.kind === "doc" && selection.name === d.name;
          const isStateDoc = d.name === "state";
          const staleness = stalenessFor(d.lastModified);
          const stalenessColor = STALENESS_COLOR[staleness];
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => onSelect({ kind: "doc", name: d.name })}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block",
                padding: isStateDoc ? "12px 14px" : "10px 12px",
                background: isStateDoc
                  ? "var(--session-walnut-surface)"
                  : "var(--session-walnut-surface-soft)",
                border: `1px solid ${
                  selected
                    ? "var(--session-walnut-meta)"
                    : isStateDoc
                      ? "var(--session-walnut-border)"
                      : "var(--session-walnut-border-soft)"
                }`,
                borderRadius: 7,
                boxShadow: selected
                  ? "0 0 0 1px var(--session-walnut-meta)"
                  : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--session-ink-soft)",
                  }}
                >
                  {meta.filename}
                </code>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.5px",
                    color: stalenessColor.fg,
                    background: stalenessColor.bg,
                    padding: "1px 6px",
                    borderRadius: 3,
                    textTransform: "uppercase",
                  }}
                >
                  {daysAgo(d.lastModified)}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: isStateDoc ? 17 : 15.5,
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "var(--session-ink)",
                  letterSpacing: "-0.005em",
                  marginBottom: 4,
                  lineHeight: 1.25,
                }}
              >
                {meta.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: "var(--session-ink-soft)",
                  marginBottom: 2,
                }}
              >
                {meta.oneLine}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.4px",
                  color: "var(--session-ink-ghost)",
                  textTransform: "uppercase",
                }}
              >
                Audience: {meta.audience}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADR navigator
// ---------------------------------------------------------------------------

function AdrNavigator({
  adrs,
  counts,
  filter,
  setFilter,
  selection,
  onSelect,
}: {
  adrs: AdrEntry[];
  counts: Record<AdrStatus, number>;
  filter: "all" | AdrStatus;
  setFilter: (f: "all" | AdrStatus) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const total = counts.active + counts.reversed + counts.superseded + counts.amended;
  type ChipKey = "all" | AdrStatus;
  const chips: { key: ChipKey; label: string; count: number }[] = (
    [
      { key: "all" as ChipKey, label: "All", count: total },
      { key: "active" as ChipKey, label: "Active", count: counts.active },
      { key: "reversed" as ChipKey, label: "Reversed", count: counts.reversed },
      { key: "superseded" as ChipKey, label: "Superseded", count: counts.superseded },
      { key: "amended" as ChipKey, label: "Amended", count: counts.amended },
    ]
  ).filter((c) => c.count > 0 || c.key === "all");

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta)",
            textTransform: "uppercase",
          }}
        >
          Decisions
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--session-ink-ghost)",
          }}
        >
          {adrs.length} of {total}
        </span>
      </div>
      <p
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          fontStyle: "italic",
          lineHeight: 1.45,
          color: "var(--session-ink-soft)",
        }}
      >
        Architectural decision records — short writeups of why we did
        things. Parsed live from <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--session-ink)", background: "var(--session-walnut-surface-soft)", padding: "1px 5px", borderRadius: 3 }}>decisions.md</code>.
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 10,
        }}
      >
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
                padding: "3px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.5px",
                color: active
                  ? "var(--session-ink)"
                  : "var(--session-ink-soft)",
                background: active
                  ? "var(--session-walnut-highlight)"
                  : "var(--session-walnut-tint)",
                border: `1px solid ${
                  active
                    ? "var(--session-walnut-border)"
                    : "var(--session-walnut-border-soft)"
                }`,
                borderRadius: 999,
                textTransform: "uppercase",
                fontWeight: active ? 500 : 400,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {c.label}
              <span
                style={{
                  color: "var(--session-ink-ghost)",
                  fontWeight: 400,
                  fontSize: 10,
                }}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {adrs.map((a) => {
          const selected =
            selection.kind === "adr" && selection.number === a.number;
          const statusColor = ADR_STATUS_COLOR[a.status];
          return (
            <button
              key={a.number}
              type="button"
              onClick={() => onSelect({ kind: "adr", number: a.number })}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block",
                padding: "6px 10px",
                background: selected
                  ? "var(--session-walnut-highlight)"
                  : "var(--session-walnut-tint)",
                border: `1px solid ${
                  selected
                    ? "var(--session-walnut-meta)"
                    : "var(--session-walnut-border-soft)"
                }`,
                borderRadius: 5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 1,
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--session-ink-soft)",
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  ADR-{String(a.number).padStart(3, "0")}
                </code>
                {a.status !== "active" && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.5px",
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: statusColor.bg,
                      color: statusColor.fg,
                      border: `1px solid ${statusColor.border}`,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {ADR_STATUS_LABEL[a.status]}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  color: "var(--session-ink)",
                  lineHeight: 1.35,
                }}
              >
                {a.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reader — sticky right column. Renders the selected doc or ADR.
// ---------------------------------------------------------------------------

function Reader({
  selection,
  docs,
  adrs,
  onBackToDecisions,
}: {
  selection: Selection;
  docs: DocFile[];
  adrs: AdrEntry[];
  onBackToDecisions: () => void;
}) {
  if (selection.kind === "doc") {
    const doc = docs.find((d) => d.name === selection.name);
    if (!doc) {
      return (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--session-ink-ghost)",
            padding: 16,
          }}
        >
          Loading…
        </div>
      );
    }
    return (
      <article className="doc-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
      </article>
    );
  }

  // ADR view
  const adr = adrs.find((a) => a.number === selection.number);
  if (!adr) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--session-ink-ghost)",
          padding: 16,
        }}
      >
        ADR not found.
      </div>
    );
  }
  const statusColor = ADR_STATUS_COLOR[adr.status];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta)",
            textTransform: "uppercase",
          }}
        >
          ADR-{String(adr.number).padStart(3, "0")}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "1.2px",
              padding: "2px 6px",
              borderRadius: 3,
              background: statusColor.bg,
              color: statusColor.fg,
              border: `1px solid ${statusColor.border}`,
            }}
          >
            {ADR_STATUS_LABEL[adr.status]}
          </span>
        </div>
        <button
          type="button"
          onClick={onBackToDecisions}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--session-ink-soft)",
            padding: "4px 10px",
            borderRadius: 5,
            border: "1px solid var(--session-walnut-border-soft)",
            background: "var(--session-walnut-tint)",
          }}
        >
          ← Full decisions.md
        </button>
      </div>
      <article className="doc-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{adr.content}</ReactMarkdown>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown styles (global, scoped to .doc-markdown)
// ---------------------------------------------------------------------------

function DocMarkdownStyles() {
  return (
    <style jsx global>{`
      .doc-markdown {
        font-family: var(--font-spectral, var(--font-serif));
        font-size: 15px;
        line-height: 1.65;
        color: var(--session-ink);
        max-width: 720px;
      }
      .doc-markdown h1,
      .doc-markdown h2,
      .doc-markdown h3,
      .doc-markdown h4 {
        font-family: var(--font-spectral, var(--font-serif));
        color: var(--session-ink);
        line-height: 1.25;
        margin-top: 1.6em;
        margin-bottom: 0.5em;
        font-weight: 400;
        font-style: italic;
        letter-spacing: -0.005em;
      }
      .doc-markdown h1 {
        font-size: 28px;
        margin-top: 0;
      }
      .doc-markdown h2 {
        font-size: 22px;
      }
      .doc-markdown h3 {
        font-size: 17px;
      }
      .doc-markdown h4 {
        font-size: 15px;
      }
      .doc-markdown p,
      .doc-markdown ul,
      .doc-markdown ol {
        margin: 0.7em 0;
        font-family: var(--font-spectral, var(--font-serif));
      }
      .doc-markdown ul,
      .doc-markdown ol {
        padding-left: 1.5em;
      }
      .doc-markdown li {
        margin: 0.25em 0;
      }
      .doc-markdown strong {
        font-weight: 500;
        color: var(--session-ink);
      }
      .doc-markdown em {
        font-style: italic;
      }
      .doc-markdown hr {
        border: none;
        border-top: 1px solid var(--session-ink-hairline);
        margin: 2em 0;
      }
      .doc-markdown code {
        font-family: var(--font-mono);
        font-size: 0.88em;
        background: var(--session-walnut-surface-soft);
        padding: 1px 6px;
        border-radius: 3px;
        color: var(--session-ink);
      }
      .doc-markdown pre {
        background: var(--session-walnut-surface-soft);
        border: 1px solid var(--session-walnut-border-soft);
        padding: 14px 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 1em 0;
      }
      .doc-markdown pre code {
        background: none;
        border: none;
        padding: 0;
        font-size: 12.5px;
      }
      .doc-markdown blockquote {
        border-left: 3px solid var(--session-walnut-border);
        padding-left: 14px;
        color: var(--session-ink-soft);
        font-style: italic;
        margin: 1em 0;
      }
      .doc-markdown table {
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 13px;
        font-family: var(--font-sans);
      }
      .doc-markdown th,
      .doc-markdown td {
        border: 1px solid var(--session-ink-hairline);
        padding: 6px 10px;
        text-align: left;
      }
      .doc-markdown th {
        background: var(--session-walnut-tint);
        font-weight: 500;
      }
      .doc-markdown a {
        color: var(--session-ink);
        text-decoration: underline;
        text-decoration-color: var(--session-walnut-border);
        text-underline-offset: 3px;
      }
    `}</style>
  );
}
