import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { applyDyslexicFont } from "./usePersonaDyslexicFont";

// The hook itself (`usePersonaDyslexicFont`) is harder to test in isolation —
// it depends on Supabase + window storage events + React lifecycle. The
// utility it delegates to (`applyDyslexicFont`) is pure-ish (mutates DOM
// + localStorage) and carries the contract that matters for correctness:
// attribute presence and localStorage value reflect the boolean argument.
//
// vitest's default environment is "node" (no DOM, no localStorage). Rather
// than pull in jsdom for one test, we stub minimal document + localStorage
// shims and assert against them directly.

interface FakeElement {
  attrs: Map<string, string>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}

function makeFakeElement(): FakeElement {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (name, value) => void attrs.set(name, value),
    removeAttribute: (name) => void attrs.delete(name),
    getAttribute: (name) => attrs.get(name) ?? null,
    hasAttribute: (name) => attrs.has(name),
  };
}

interface FakeStorage {
  store: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  clear(): void;
}

function makeFakeStorage(
  setItemImpl?: (k: string, v: string) => void,
): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: setItemImpl ?? ((key, value) => void store.set(key, value)),
    clear: () => store.clear(),
  };
}

describe("applyDyslexicFont", () => {
  let html: FakeElement;
  let storage: FakeStorage;

  beforeEach(() => {
    html = makeFakeElement();
    storage = makeFakeStorage();
    vi.stubGlobal("document", { documentElement: html });
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the html attribute to 'true' when enabled", () => {
    applyDyslexicFont(true);
    expect(html.getAttribute("data-persona-dyslexic")).toBe("true");
  });

  it("writes 'true' to localStorage when enabled", () => {
    applyDyslexicFont(true);
    expect(storage.getItem("mywalnut.persona-dyslexic")).toBe("true");
  });

  it("removes the html attribute when disabled", () => {
    html.setAttribute("data-persona-dyslexic", "true");
    applyDyslexicFont(false);
    expect(html.hasAttribute("data-persona-dyslexic")).toBe(false);
  });

  it("writes 'false' to localStorage when disabled", () => {
    applyDyslexicFont(false);
    expect(storage.getItem("mywalnut.persona-dyslexic")).toBe("false");
  });

  it("is idempotent across repeated calls", () => {
    applyDyslexicFont(true);
    applyDyslexicFont(true);
    applyDyslexicFont(false);
    applyDyslexicFont(false);
    expect(html.hasAttribute("data-persona-dyslexic")).toBe(false);
    expect(storage.getItem("mywalnut.persona-dyslexic")).toBe("false");
  });

  it("survives localStorage throwing (private mode) without raising", () => {
    // Re-stub localStorage to throw on setItem, simulating private-mode
    // browser behavior. The attribute write still has to land because the
    // attribute is the runtime source of truth.
    const throwingStorage = makeFakeStorage(() => {
      throw new Error("QuotaExceededError");
    });
    vi.stubGlobal("localStorage", throwingStorage);

    expect(() => applyDyslexicFont(true)).not.toThrow();
    expect(html.getAttribute("data-persona-dyslexic")).toBe("true");
  });

  it("is a no-op in non-DOM environments", () => {
    vi.stubGlobal("document", undefined);
    expect(() => applyDyslexicFont(true)).not.toThrow();
  });
});
