"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

type Doc = {
  name: string;
  filename: string;
  lastModified: string;
  content: string;
};

const DOC_ORDER = ["intent", "system", "rules", "state", "decisions"] as const;
const STALE_DAYS = 7;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export default function AdminDocsPage() {
  const isAdmin = useIsAdmin();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string>("intent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/docs");
        if (!res.ok) return;
        const json = await res.json();
        const sorted: Doc[] = (json.docs || []).sort(
          (a: Doc, b: Doc) =>
            DOC_ORDER.indexOf(a.name as (typeof DOC_ORDER)[number]) -
            DOC_ORDER.indexOf(b.name as (typeof DOC_ORDER)[number])
        );
        setDocs(sorted);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const current = useMemo(
    () => docs.find((d) => d.name === selected) || null,
    [docs, selected]
  );

  const stateDoc = docs.find((d) => d.name === "state");
  const showStale =
    current?.name === "state" &&
    stateDoc &&
    daysSince(stateDoc.lastModified) > STALE_DAYS;

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
        READ ONLY — ADMIN
      </div>

      <div
        className="admin-shell"
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <nav
          className="admin-rail"
          style={{
            width: 180,
            borderRight: "1px solid var(--session-ink-hairline)",
            padding: "20px 12px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              color: "var(--session-ink-ghost)",
              padding: "4px 12px 10px",
            }}
          >
            ADMIN
          </div>
          <Link href="/admin?section=users" style={railLinkStyle(false)}>
            Users
          </Link>
          <Link href="/admin?section=beta" style={railLinkStyle(false)}>
            Beta
          </Link>
          <Link href="/admin?section=feedback" style={railLinkStyle(false)}>
            Feedback
          </Link>
          <Link href="/admin/docs" style={railLinkStyle(true)}>
            Docs
          </Link>
          <div style={{ flex: 1 }} />
          <a
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "1px",
              padding: "8px 12px",
              textDecoration: "none",
            }}
          >
            ← EXIT ADMIN
          </a>
        </nav>

        <main
          style={{
            flex: 1,
            display: "flex",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            className="admin-docs-list"
            style={{
              width: 240,
              borderRight: "1px solid var(--session-ink-hairline)",
              overflowY: "auto",
              flexShrink: 0,
              padding: "16px 12px 40px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                letterSpacing: "2px",
                color: "var(--session-ink-ghost)",
                padding: "4px 12px 10px",
              }}
            >
              DOCS
            </div>
            {loading && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  padding: "8px 12px",
                }}
              >
                Loading…
              </div>
            )}
            <button
              onClick={() => setSelected("mapping")}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background:
                  selected === "mapping" ? "rgba(255,255,255,0.6)" : "none",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                cursor: "pointer",
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color:
                    selected === "mapping"
                      ? "var(--session-ink)"
                      : "var(--session-ink-ghost)",
                  fontWeight: selected === "mapping" ? 500 : 400,
                }}
              >
                docs mapping
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  marginTop: 2,
                  letterSpacing: "0.5px",
                }}
              >
                reference
              </div>
            </button>
            {docs.map((d) => {
              const active = d.name === selected;
              return (
                <button
                  key={d.name}
                  onClick={() => setSelected(d.name)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: active ? "rgba(255,255,255,0.6)" : "none",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: active
                        ? "var(--session-ink)"
                        : "var(--session-ink-ghost)",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {d.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: "var(--session-ink-ghost)",
                      marginTop: 2,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {formatDate(d.lastModified)}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="admin-docs-content"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 40px 60px",
              minWidth: 0,
            }}
          >
            {showStale && (
              <div
                style={{
                  background: "#FFF5CC",
                  border: "1px solid #E6C200",
                  borderRadius: 6,
                  padding: "10px 14px",
                  marginBottom: 20,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#5C4A00",
                }}
              >
                Last updated {formatDate(stateDoc!.lastModified)}. May be stale.
              </div>
            )}
            {selected === "mapping" ? (
              <iframe
                src="/admin/docs-mapping.html"
                title="Docs mapping"
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "calc(100vh - 120px)",
                  border: "none",
                  background: "transparent",
                }}
              />
            ) : current ? (
              <article className="doc-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {current.content}
                </ReactMarkdown>
              </article>
            ) : (
              !loading && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--size-meta)",
                    color: "var(--session-ink-ghost)",
                  }}
                >
                  Select a doc.
                </div>
              )
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .doc-markdown {
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.65;
          color: var(--session-ink);
          max-width: 720px;
        }
        .doc-markdown h1,
        .doc-markdown h2,
        .doc-markdown h3,
        .doc-markdown h4 {
          font-family: var(--font-serif, var(--font-sans));
          color: var(--session-ink);
          line-height: 1.25;
          margin-top: 1.6em;
          margin-bottom: 0.5em;
          font-weight: 500;
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
        }
        .doc-markdown ul,
        .doc-markdown ol {
          padding-left: 1.5em;
        }
        .doc-markdown li {
          margin: 0.25em 0;
        }
        .doc-markdown strong {
          font-weight: 600;
        }
        .doc-markdown hr {
          border: none;
          border-top: 1px solid var(--session-ink-hairline);
          margin: 2em 0;
        }
        .doc-markdown code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: rgba(0, 0, 0, 0.06);
          padding: 2px 5px;
          border-radius: 3px;
        }
        .doc-markdown pre {
          background: rgba(0, 0, 0, 0.08);
          padding: 14px 16px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .doc-markdown pre code {
          background: none;
          padding: 0;
          font-size: 13px;
        }
        .doc-markdown blockquote {
          border-left: 3px solid var(--session-ink-hairline);
          padding-left: 14px;
          color: var(--session-ink-ghost);
          margin: 1em 0;
        }
        .doc-markdown table {
          border-collapse: collapse;
          margin: 1em 0;
          font-size: 13px;
        }
        .doc-markdown th,
        .doc-markdown td {
          border: 1px solid var(--session-ink-hairline);
          padding: 6px 10px;
          text-align: left;
        }
        .doc-markdown th {
          background: rgba(0, 0, 0, 0.04);
          font-weight: 600;
        }
        .doc-markdown a {
          color: var(--session-error);
          text-decoration: underline;
        }
      `}</style>

      <style jsx>{`
        @media (max-width: 720px) {
          .admin-shell {
            flex-direction: column;
          }
          .admin-rail {
            width: 100% !important;
            flex-direction: row !important;
            overflow-x: auto;
            padding: 8px 12px !important;
            border-right: none !important;
            border-bottom: 1px solid var(--session-ink-hairline);
          }
          :global(main) {
            flex-direction: column !important;
          }
          .admin-docs-list {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid var(--session-ink-hairline);
            max-height: 180px;
          }
          .admin-docs-content {
            padding: 20px 18px 60px !important;
          }
        }
      `}</style>
    </div>
  );
}

function railLinkStyle(active: boolean): React.CSSProperties {
  return {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
    background: active ? "rgba(255,255,255,0.6)" : "none",
    borderRadius: 6,
    padding: "8px 12px",
    textDecoration: "none",
    fontWeight: active ? 500 : 400,
  };
}
