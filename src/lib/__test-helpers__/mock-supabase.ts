import { vi } from "vitest";

type MockData = { data: unknown; error: null } | { data: null; error: { message: string } };

/**
 * Creates a chainable mock that mimics the Supabase query builder API.
 * By default all terminal calls resolve to { data: null, error: null }.
 *
 * Usage:
 *   const mock = createMockSupabase();
 *   vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mock }));
 *
 * To configure specific responses:
 *   mock._setResponse("messages", { data: { id: "123", content: "hi" }, error: null });
 */
export function createMockSupabase() {
  const responses = new Map<string, MockData>();
  let currentTable = "";

  const defaultResponse: MockData = { data: null, error: null };

  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};

    const self = () => chain;

    chain.from = vi.fn((table: string) => {
      currentTable = table;
      return chain;
    });
    chain.select = vi.fn(self);
    chain.insert = vi.fn(self);
    chain.update = vi.fn(self);
    chain.upsert = vi.fn(self);
    chain.delete = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.neq = vi.fn(self);
    chain.is = vi.fn(self);
    chain.in = vi.fn(self);
    chain.order = vi.fn(self);
    chain.limit = vi.fn(self);
    chain.single = vi.fn(() =>
      Promise.resolve(responses.get(currentTable) ?? defaultResponse)
    );
    chain.maybeSingle = vi.fn(() =>
      Promise.resolve(responses.get(currentTable) ?? defaultResponse)
    );
    chain.then = vi.fn((cb: (val: MockData) => void) =>
      Promise.resolve(responses.get(currentTable) ?? defaultResponse).then(cb)
    );

    // Test configuration helper
    chain._setResponse = (table: string, response: MockData) => {
      responses.set(table, response);
    };

    chain._reset = () => {
      responses.clear();
    };

    return chain;
  };

  return makeChain();
}
