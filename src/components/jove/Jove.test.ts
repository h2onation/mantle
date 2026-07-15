import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Jove from "./Jove";

function renderJove(size = 72) {
  return renderToStaticMarkup(createElement(Jove, { size }));
}

describe("Jove", () => {
  it("renders a size-driven square SVG with a stable viewBox", () => {
    const markup = renderJove(48);

    expect(markup).toContain('width="48"');
    expect(markup).toContain('height="48"');
    expect(markup).toContain('viewBox="0 0 120 120"');
  });

  it("renders as a decorative currentColor monoline figure", () => {
    const markup = renderJove();

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('focusable="false"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('fill="none"');
    expect(markup).toContain('stroke-linecap="round"');
    expect(markup).toContain('stroke-linejoin="round"');
    expect(markup).toContain("pointer-events:none");
  });

  it("contains no canvas, image, or embedded raster reference", () => {
    const markup = renderJove().toLowerCase();

    expect(markup).not.toContain("<image");
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("data:image");
    expect(markup).not.toContain(".png");
    expect(markup).not.toContain("01-model-sheet");
  });
});
