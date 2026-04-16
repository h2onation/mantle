import { describe, it, expect } from "vitest";
import { confirmErrorMessage } from "@/lib/hooks/useChat";

describe("confirmErrorMessage taxonomy", () => {
  // Network / transport failures. Fetch threw or aborted — we never got
  // an HTTP status from the server.
  describe("network failure", () => {
    it("maps networkFailed=true to a retry-flavored message", () => {
      expect(confirmErrorMessage(null, true)).toBe(
        "Couldn't reach the server. Please try again."
      );
    });

    it("maps null status (no response) to the same message even if networkFailed=false", () => {
      // Defensive — should never happen in practice, but still mappable.
      expect(confirmErrorMessage(null, false)).toBe(
        "Couldn't reach the server. Please try again."
      );
    });
  });

  // Client-error HTTP statuses (don't retry, surface specific guidance).
  describe("4xx responses", () => {
    it("429 suggests backing off, doesn't blame the user", () => {
      const msg = confirmErrorMessage(429, false);
      expect(msg).toContain("a lot recently");
      expect(msg).toContain("minute");
    });

    it("404 hints the checkpoint is gone and to refresh", () => {
      expect(confirmErrorMessage(404, false).toLowerCase()).toContain(
        "refresh"
      );
    });

    it("400 specifically mentions the rejected/refined state", () => {
      const msg = confirmErrorMessage(400, false);
      expect(msg).toContain("rejected or refined");
    });

    it("other 4xx (403) falls through to a generic client-bug message", () => {
      expect(confirmErrorMessage(403, false)).toBe(
        "Something's off on my end. Refresh and try again."
      );
    });
  });

  // Server errors — transient, user should retry, not their fault.
  describe("5xx responses", () => {
    it("500 maps to the server-hiccup message", () => {
      expect(confirmErrorMessage(500, false)).toBe(
        "Server hiccup. Please try again."
      );
    });

    it("502, 503, 504 all get the same server-hiccup message", () => {
      const msg502 = confirmErrorMessage(502, false);
      const msg503 = confirmErrorMessage(503, false);
      const msg504 = confirmErrorMessage(504, false);
      expect(msg502).toBe(msg503);
      expect(msg503).toBe(msg504);
      expect(msg502).toContain("hiccup");
    });
  });

  // Defensive: status codes that shouldn't reach the helper (200, 3xx).
  describe("unexpected inputs", () => {
    it("2xx returns a generic fallback (should never be called for success)", () => {
      // This path means upstream logic is confused, so a generic fallback
      // is fine — it won't actually be surfaced to users.
      expect(confirmErrorMessage(200, false)).toContain("went wrong");
    });

    it("3xx returns a generic fallback", () => {
      expect(confirmErrorMessage(302, false)).toContain("went wrong");
    });
  });

  // Sanity: every message is a complete sentence, non-empty, no raw template
  // leakage like "undefined" or "null".
  describe("message quality", () => {
    const allStatuses: (number | null)[] = [
      null,
      200,
      302,
      400,
      401,
      403,
      404,
      429,
      500,
      502,
      503,
      504,
    ];

    for (const status of allStatuses) {
      it(`status=${status ?? "null"} produces a sanitized non-empty message`, () => {
        const msg = confirmErrorMessage(status, status === null);
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).not.toContain("undefined");
        expect(msg).not.toContain("null");
        expect(msg).not.toContain("{{");
        // Should end with punctuation (sentence-ish).
        expect(msg).toMatch(/[.!?]$/);
      });
    }
  });
});
