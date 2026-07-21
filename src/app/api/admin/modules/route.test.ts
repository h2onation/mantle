import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CONDUCTOR_PROMPT,
  CONDUCTOR_REQUIRED_FRAGMENTS,
} from "@/lib/persona/conductor-prompt";

const mockVerifyAdmin = vi.fn();
vi.mock("@/lib/admin/verify-admin", () => ({
  verifyAdmin: () => mockVerifyAdmin(),
  requireAdmin: async () => {
    const r = await mockVerifyAdmin();
    if (!r.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return { userId: r.userId, admin: createAdminClient() };
  },
}));

// Table-aware fake: modules list/insert/update/delete, reference counts for
// conversations/manual_entries, and the persona_voice_overrides read that
// getVoiceOverrides makes for conductorText.
let moduleRows: Array<Record<string, unknown>> = [];
let insertCalls: Array<Record<string, unknown>> = [];
let insertError: { code?: string; message: string } | null = null;
let updateCalls: Array<Record<string, unknown>> = [];
let updateMatches: number = 1;
let deleteCalls: string[] = [];
let entryDeleteCalls: string[] = [];
let refCounts: Record<string, number> = { conversations: 0, manual_entries: 0 };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "modules") {
        return {
          select: () => ({
            order: () => ({
              order: async () => ({ data: moduleRows, error: null }),
            }),
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            insertCalls.push(row);
            return { error: insertError };
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, slug: string) => ({
              select: async () => {
                updateCalls.push({ ...patch, __slug: slug });
                return {
                  data: updateMatches > 0 ? [{ slug }] : [],
                  error: null,
                };
              },
            }),
          }),
          delete: () => ({
            eq: async (_col: string, slug: string) => {
              deleteCalls.push(slug);
              return { error: null };
            },
          }),
        };
      }
      if (table === "conversations" || table === "manual_entries") {
        return {
          select: () => ({
            eq: async () => ({ count: refCounts[table], error: null }),
          }),
          delete: () => ({
            eq: async (_col: string, slug: string) => {
              entryDeleteCalls.push(`${table}:${slug}`);
              return { error: null };
            },
          }),
        };
      }
      if (table === "persona_voice_overrides") {
        return {
          select: async () => ({ data: [], error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { GET, POST, PATCH, DELETE } from "@/app/api/admin/modules/route";

beforeEach(() => {
  mockVerifyAdmin.mockReset();
  mockVerifyAdmin.mockResolvedValue({ userId: "admin-1", isAdmin: true });
  moduleRows = [];
  insertCalls = [];
  insertError = null;
  updateCalls = [];
  updateMatches = 1;
  deleteCalls = [];
  entryDeleteCalls = [];
  refCounts = { conversations: 0, manual_entries: 0 };
});

function req(method: string, body: unknown): Request {
  return new Request("http://localhost/api/admin/modules", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A custom prompt that satisfies every required fragment.
const SAFE_PROMPT =
  "You are Jove.\n" +
  CONDUCTOR_REQUIRED_FRAGMENTS.map((f) => f.fragment).join("\n");

describe("auth", () => {
  it("all verbs return 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    expect((await GET()).status).toBe(403);
    expect((await POST(req("POST", { slug: "x", name: "X" }))).status).toBe(403);
    expect((await PATCH(req("PATCH", { slug: "x", name: "X" }))).status).toBe(403);
    expect((await DELETE(req("DELETE", { slug: "x" }))).status).toBe(403);
  });
});

describe("GET", () => {
  it("returns modules and the live conductor text (code default with no override)", async () => {
    const res = await GET();
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.modules).toEqual([]);
    expect(d.conductorText).toBe(CONDUCTOR_PROMPT);
  });
});

describe("POST — create", () => {
  it("rejects an invalid slug with the plain-language format error", async () => {
    const res = await POST(req("POST", { slug: "Bad Slug", name: "X" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("lowercase");
    expect(insertCalls).toHaveLength(0);
  });

  it("rejects a missing name", async () => {
    const res = await POST(req("POST", { slug: "burnout" }));
    expect(res.status).toBe(400);
  });

  it("rejects a custom prompt that drops the crisis/reflection fragments", async () => {
    const res = await POST(
      req("POST", { slug: "burnout", name: "Burnout", custom_prompt: "Just vibes." }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("988");
    expect(insertCalls).toHaveLength(0);
  });

  it("creates with coerced fields and stamps updated_by", async () => {
    const res = await POST(
      req("POST", {
        slug: "burnout",
        name: "  Burnout at work  ",
        opener_text: "   ",
        custom_prompt: SAFE_PROMPT,
      }),
    );
    expect(res.status).toBe(200);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      slug: "burnout",
      name: "Burnout at work",
      opener_text: null, // blank coerces to "not set"
      custom_prompt: SAFE_PROMPT,
      updated_by: "admin-1",
    });
  });

  it("maps a unique-violation to 409", async () => {
    insertError = { code: "23505", message: "duplicate key" };
    const res = await POST(req("POST", { slug: "burnout", name: "Burnout" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("already exists");
  });
});

describe("PATCH — update", () => {
  it("nulls blank prose fields and never writes the slug as a field", async () => {
    const res = await PATCH(
      req("PATCH", { slug: "burnout", opener_text: "", custom_prompt: "  " }),
    );
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      opener_text: null,
      custom_prompt: null,
      __slug: "burnout",
    });
    expect("slug" in updateCalls[0]).toBe(false);
  });

  it("applies the same custom-prompt guard on update", async () => {
    const res = await PATCH(
      req("PATCH", { slug: "burnout", custom_prompt: "no fragments here" }),
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("404s on an unknown slug", async () => {
    updateMatches = 0;
    const res = await PATCH(req("PATCH", { slug: "ghost", name: "Ghost" }));
    expect(res.status).toBe(404);
  });

  it("rejects an empty update", async () => {
    const res = await PATCH(req("PATCH", { slug: "burnout" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE — plain (only while unreferenced)", () => {
  it("deletes a module nothing points at", async () => {
    const res = await DELETE(req("DELETE", { slug: "typo-module" }));
    expect(res.status).toBe(200);
    expect(deleteCalls).toEqual(["typo-module"]);
    expect(entryDeleteCalls).toHaveLength(0);
  });

  it("409s with the blast radius when references exist", async () => {
    refCounts = { conversations: 2, manual_entries: 3 };
    const res = await DELETE(req("DELETE", { slug: "burnout" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.requiresForce).toBe(true);
    expect(body.conversations).toBe(2);
    expect(body.entries).toBe(3);
    expect(deleteCalls).toHaveLength(0);
    expect(entryDeleteCalls).toHaveLength(0);
  });
});

describe("DELETE — deleteEntries (the founder-confirmed destructive path)", () => {
  it("deletes the module's entries, then the module; conversations untouched", async () => {
    refCounts = { conversations: 2, manual_entries: 3 };
    const res = await DELETE(
      req("DELETE", { slug: "burnout", deleteEntries: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedEntries).toBe(3);
    // Entries delete targets manual_entries only — never conversations.
    expect(entryDeleteCalls).toEqual(["manual_entries:burnout"]);
    expect(deleteCalls).toEqual(["burnout"]);
  });

  it("skips the entries delete when the module has none (conversations-only refs)", async () => {
    refCounts = { conversations: 5, manual_entries: 0 };
    const res = await DELETE(
      req("DELETE", { slug: "burnout", deleteEntries: true })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).deletedEntries).toBe(0);
    expect(entryDeleteCalls).toHaveLength(0);
    expect(deleteCalls).toEqual(["burnout"]);
  });
});
