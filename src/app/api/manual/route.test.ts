import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockRequireUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => mockRequireUser(),
}));

const mockRecordApiError = vi.fn(() => Promise.resolve());
vi.mock("@/lib/observability/record-api-error", () => ({
  recordApiError: () => mockRecordApiError(),
}));

// The Supabase query builder is a thenable: awaiting the manual_entries
// chain (…select().eq().order().order()) resolves to { data, error }, while
// the profiles chain ends in .single() returning a promise. Each test
// configures the two results below.
let manualEntriesResult: { data: unknown; error: unknown };
let profileResult: { data: unknown; error: unknown };
// Captures the column list passed to manual_entries.select() so a test can
// assert `section` is fetched — its omission would leave every entry
// section-undefined and ungrouped (the read-path never saw the structural key).
let manualEntriesSelect = "";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "manual_entries") {
        const builder: Record<string, unknown> = {};
        builder.select = (cols: string) => {
          manualEntriesSelect = cols;
          return builder;
        };
        builder.eq = () => builder;
        builder.order = () => builder;
        builder.then = (resolve: (v: unknown) => void) =>
          resolve(manualEntriesResult);
        return builder;
      }
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.single = () => Promise.resolve(profileResult);
      return builder;
    },
  }),
}));

import { GET } from "@/app/api/manual/route";

beforeEach(() => {
  mockRequireUser.mockReset();
  mockRequireUser.mockReturnValue({
    user: { id: "u1", email: "alex@example.com" },
  });
  mockRecordApiError.mockClear();
  manualEntriesResult = { data: [], error: null };
  profileResult = { data: { display_name: "Alex" }, error: null };
  manualEntriesSelect = "";
});

// --- Tests ---------------------------------------------------------------

const sampleEntry = {
  id: "e1",
  layer: 1,
  name: "Entry",
  content: "...",
  created_at: "",
  updated_at: "",
};

describe("/api/manual — GET", () => {
  it("returns the user's entries and display name on success", async () => {
    manualEntriesResult = { data: [sampleEntry], error: null };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      components: unknown[];
      displayName: string;
    };
    expect(body.components).toHaveLength(1);
    expect(body.displayName).toBe("Alex");
  });

  // Regression guard: the Manual groups by `section`. If the read-path omits
  // the column, every entry arrives section-undefined and groups into nothing.
  it("selects the section column so entries can be grouped by section", async () => {
    manualEntriesResult = { data: [sampleEntry], error: null };
    await GET();
    expect(manualEntriesSelect).toContain("section");
  });

  // The core data-loss guard: a transient DB read error must NOT come back as
  // 200 with an empty manual (which the client would store as "manual gone").
  it("returns 500 — never 200-with-empty — when the manual_entries read errors", async () => {
    manualEntriesResult = { data: null, error: { message: "connection reset" } };
    const res = await GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; components?: unknown };
    expect(body.error).toBeTruthy();
    // Critically, it did NOT fall through to an empty components array.
    expect(body.components).toBeUndefined();
    expect(mockRecordApiError).toHaveBeenCalledTimes(1);
  });

  // A profile read error is non-critical (display name only) — it must NOT
  // fail the whole request or blank the manual; it falls back to the email.
  it("still returns 200 with a fallback name when only the profile read fails", async () => {
    manualEntriesResult = { data: [sampleEntry], error: null };
    profileResult = { data: null, error: { message: "profile read failed" } };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      components: unknown[];
      displayName: string;
    };
    expect(body.components).toHaveLength(1);
    expect(body.displayName).toBe("alex"); // email-prefix fallback
  });
});
