"use client";

import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

type Skill = {
  id: string;
  name: string;
  description: string;
  invocation: string | null;
  scope:
    | "project-command"
    | "project-agent"
    | "project-skill"
    | "user-agent"
    | "user-skill";
  origin: "built" | "installed";
  source: string;
  body: string;
};

const SCOPE_LABEL: Record<Skill["scope"], string> = {
  "project-command": "Slash command",
  "project-agent": "Project agent",
  "project-skill": "Project skill",
  "user-agent": "User agent",
  "user-skill": "User skill",
};

const SCOPE_BLURB: Record<Skill["scope"], string> = {
  "project-command":
    "Lives in `.claude/commands/`. Invoked by typing the slash command in Claude Code.",
  "project-agent":
    "Lives in `.claude/agents/`. A specialist subagent the main agent can delegate to — invoke via natural language (e.g. \"have the senior-engineer review this\") or the `/agents` menu.",
  "project-skill":
    "Lives in `.claude/skills/`. Loaded into the project when its name is invoked.",
  "user-agent":
    "Lives in `~/.claude/agents/`. A subagent available across every Claude Code session you run.",
  "user-skill":
    "Lives in `~/.claude/skills/`. Available across every Claude Code session you run.",
};

const ORIGIN_LABEL: Record<Skill["origin"], string> = {
  built: "Built",
  installed: "Installed",
};

export default function AdminSkillsPage() {
  const isAdmin = useIsAdmin();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/skills")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setSkills(j.skills as Skill[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [isAdmin]);

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

  // Group by scope for the layout
  const grouped = (skills || []).reduce<Record<Skill["scope"], Skill[]>>(
    (acc, s) => {
      (acc[s.scope] ||= []).push(s);
      return acc;
    },
    {} as Record<Skill["scope"], Skill[]>,
  );
  const order: Skill["scope"][] = [
    "project-command",
    "project-agent",
    "project-skill",
    "user-agent",
    "user-skill",
  ];

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
        <AdminNavRail activeId="skills" />

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 48px 60px",
            minWidth: 0,
          }}
        >
          <div style={{ maxWidth: 820 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 32,
                fontStyle: "italic",
                fontWeight: 400,
                color: "var(--session-ink)",
                letterSpacing: "-0.3px",
              }}
            >
              Agents &amp; Skills
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--session-ink-soft)",
                maxWidth: 620,
              }}
            >
              Subagents, slash commands, and skills loaded into this workspace.
              Subagents are specialist Claude instances the main agent can
              delegate to. Built ones live in the repo and ship with the
              project; installed ones come from elsewhere — the agent skills
              marketplace, another project, or your global Claude Code config.
            </p>

            {error && (
              <p
                style={{
                  marginTop: 24,
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-error)",
                }}
              >
                Failed to load skills: {error}
              </p>
            )}

            {!skills && !error && (
              <p
                style={{
                  marginTop: 24,
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  letterSpacing: "1px",
                }}
              >
                Loading…
              </p>
            )}

            {skills &&
              order.map((scope) => {
                const items = grouped[scope] || [];
                if (items.length === 0) return null;
                return (
                  <section key={scope} style={{ marginTop: 40 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "var(--session-walnut)",
                        fontWeight: 600,
                      }}
                    >
                      {SCOPE_LABEL[scope]}
                      <span
                        style={{
                          marginLeft: 8,
                          color: "var(--session-ink-mid)",
                          fontWeight: 400,
                        }}
                      >
                        · {items.length}
                      </span>
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 16px",
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--session-ink-mid)",
                      }}
                    >
                      {SCOPE_BLURB[scope]}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {items.map((skill) => {
                        const expanded = expandedId === skill.id;
                        return (
                          <article
                            key={`${skill.scope}-${skill.id}`}
                            style={{
                              background: "var(--session-walnut-surface-soft)",
                              border: "1px solid var(--session-walnut-border)",
                              borderRadius: 8,
                              padding: "14px 16px",
                            }}
                          >
                            <header
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily:
                                    "var(--font-spectral, var(--font-serif))",
                                  fontSize: 18,
                                  fontWeight: 500,
                                  color: "var(--session-ink)",
                                }}
                              >
                                {skill.name}
                              </span>
                              {skill.invocation && (
                                <code
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 12,
                                    color: "var(--session-walnut)",
                                    background:
                                      "var(--session-walnut-surface)",
                                    padding: "1px 7px",
                                    borderRadius: 4,
                                    border:
                                      "1px solid var(--session-walnut-border)",
                                  }}
                                >
                                  {skill.invocation}
                                </code>
                              )}
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "var(--size-meta)",
                                  letterSpacing: "1px",
                                  textTransform: "uppercase",
                                  color:
                                    skill.origin === "built"
                                      ? "var(--session-persona)"
                                      : "var(--session-ink-mid)",
                                  marginLeft: "auto",
                                  fontWeight: 500,
                                }}
                              >
                                {ORIGIN_LABEL[skill.origin]}
                              </span>
                            </header>

                            {skill.description && (
                              <p
                                style={{
                                  margin: "8px 0 0",
                                  fontFamily: "var(--font-sans)",
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  color: "var(--session-ink-soft)",
                                }}
                              >
                                {skill.description}
                              </p>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                                marginTop: 10,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId(expanded ? null : skill.id)
                                }
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "var(--size-meta)",
                                  letterSpacing: "1px",
                                  textTransform: "uppercase",
                                  color: "var(--session-walnut)",
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                {expanded ? "Hide full" : "Read full"}
                              </button>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "var(--size-meta)",
                                  color: "var(--session-ink-ghost)",
                                  letterSpacing: "0.3px",
                                }}
                              >
                                {skill.source}
                              </span>
                            </div>

                            {expanded && (
                              <pre
                                style={{
                                  margin: "12px 0 0",
                                  padding: "12px 14px",
                                  background: "var(--session-linen)",
                                  border:
                                    "1px solid var(--session-walnut-border)",
                                  borderRadius: 6,
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 12,
                                  lineHeight: 1.55,
                                  color: "var(--session-ink-soft)",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  maxHeight: 360,
                                  overflowY: "auto",
                                }}
                              >
                                {skill.body.trim()}
                              </pre>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        </main>
      </div>
    </div>
  );
}
