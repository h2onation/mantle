"use client";

import { useEffect, useState } from "react";
import { adminEmptyStyle, formatAdminDate } from "./admin-shared";

interface AppliedMigration {
  version: string;
  name: string | null;
}

interface FileMigration {
  version: string;
  filename: string;
}

interface MigrationStatus {
  applied: AppliedMigration[];
  files: FileMigration[];
  missingInDb: FileMigration[];
  missingOnDisk: AppliedMigration[];
  inSync: boolean;
  checkedAt: string;
}

export default function SchemaHealthTab() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/migration-status");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as MigrationStatus;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !status) {
    return <div style={adminEmptyStyle}>Loading…</div>;
  }
  if (error) {
    return (
      <div style={{ ...adminEmptyStyle, color: "var(--session-error)" }}>
        Error: {error}
      </div>
    );
  }
  if (!status) return null;

  // Union of all versions for the table view, sorted asc.
  const allVersions = Array.from(
    new Set([
      ...status.applied.map((a) => a.version),
      ...status.files.map((f) => f.version),
    ])
  ).sort();

  const appliedMap = new Map(status.applied.map((a) => [a.version, a]));
  const fileMap = new Map(status.files.map((f) => [f.version, f]));

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Status banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 18px",
          borderRadius: 8,
          background: status.inSync
            ? "rgba(91, 122, 79, 0.12)"
            : "var(--session-error-banner)",
          border: status.inSync
            ? "1px solid rgba(91, 122, 79, 0.3)"
            : "1px solid var(--session-error-ghost)",
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: status.inSync
                ? "var(--session-persona)"
                : "var(--session-error)",
              marginBottom: 4,
            }}
          >
            {status.inSync ? "✓ In sync" : "⚠ Drift detected"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink)",
            }}
          >
            {status.inSync ? (
              <>
                All {status.applied.length} migration
                {status.applied.length === 1 ? "" : "s"} in the repo are applied
                in production.
              </>
            ) : (
              <>
                {status.missingInDb.length > 0 && (
                  <>
                    {status.missingInDb.length} file
                    {status.missingInDb.length === 1 ? "" : "s"} not applied.{" "}
                  </>
                )}
                {status.missingOnDisk.length > 0 && (
                  <>
                    {status.missingOnDisk.length} applied migration
                    {status.missingOnDisk.length === 1 ? "" : "s"} missing from
                    repo.
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink-mid)",
            background: "var(--session-cream)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {/* Drift details, if any */}
      {!status.inSync && (
        <div style={{ marginBottom: 24 }}>
          {status.missingInDb.length > 0 && (
            <DriftList
              label="Files not yet applied to prod"
              hint="Merge to main to apply via the GH Action, or run `supabase db push` locally."
              items={status.missingInDb.map((f) => ({
                version: f.version,
                subtitle: f.filename,
              }))}
            />
          )}
          {status.missingOnDisk.length > 0 && (
            <DriftList
              label="Applied in prod but missing from repo"
              hint="Either the file was deleted (investigate) or a migration was applied outside the CLI (write it into the repo)."
              items={status.missingOnDisk.map((a) => ({
                version: a.version,
                subtitle: a.name || "(no name)",
              }))}
            />
          )}
        </div>
      )}

      {/* Full migration table */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginBottom: 8,
        }}
      >
        All migrations · {allVersions.length}
      </div>
      <div
        style={{
          border: "1px solid var(--session-ink-hairline)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "rgba(0,0,0,0.02)",
                borderBottom: "1px solid var(--session-ink-hairline)",
              }}
            >
              <th style={thStyle}>Version</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, textAlign: "center", width: 90 }}>
                On disk
              </th>
              <th style={{ ...thStyle, textAlign: "center", width: 90 }}>
                In prod
              </th>
            </tr>
          </thead>
          <tbody>
            {allVersions.map((v) => {
              const applied = appliedMap.get(v);
              const file = fileMap.get(v);
              const ok = !!applied && !!file;
              return (
                <tr
                  key={v}
                  style={{
                    borderBottom: "1px solid var(--session-ink-hairline)",
                    background: ok ? "transparent" : "var(--session-error-banner)",
                  }}
                >
                  <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                    {v}
                  </td>
                  <td style={tdStyle}>
                    {applied?.name || file?.filename.replace(/^\d+_/, "").replace(/\.sql$/, "") || "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {file ? "✓" : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {applied ? "✓" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "0.5px",
          marginTop: 16,
        }}
      >
        Checked {formatAdminDate(status.checkedAt)}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-ink-ghost)",
  padding: "8px 14px",
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: "var(--session-ink)",
};

function DriftList({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: { version: string; subtitle: string }[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error)",
          marginBottom: 6,
        }}
      >
        {label} · {items.length}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: "var(--session-ink-mid)",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
      <div
        style={{
          border: "1px solid var(--session-error-ghost)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.version}
            style={{
              padding: "10px 14px",
              borderBottom:
                idx < items.length - 1
                  ? "1px solid var(--session-error-ghost)"
                  : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              display: "flex",
              gap: 16,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--session-ink-mid)" }}>
              {item.version}
            </span>
            <span style={{ color: "var(--session-ink)" }}>{item.subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
