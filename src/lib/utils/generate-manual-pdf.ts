import jsPDF from "jspdf";
import type { Layer } from "@/components/mobile/manual/layer-definitions";

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 24;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 16;

function addFooter(doc: jsPDF, name: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 155, 145);
    doc.text(
      `${name}'s Manual · Built with Mantle`,
      PAGE_WIDTH / 2,
      FOOTER_Y,
      { align: "center" }
    );
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

function wrapAndRender(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    y = checkPageBreak(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function generateManualPdf(
  name: string,
  layers: Layer[]
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const populatedLayers = layers.filter(
    (l) => l.component !== null || l.patterns.length > 0
  );

  let y = MARGIN_TOP;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(45, 40, 35);
  doc.text(`${name}'s Manual`, MARGIN_LEFT, y);
  y += 14;

  // Framing text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 85, 78);
  const framingText = `This is ${name}'s manual. They built it through conversations over time with the help of Mantle. It's not a diagnosis or a personality test. It's their own words for how they operate. They thought it would be helpful for you to understand how they relate.`;
  y = wrapAndRender(doc, framingText, MARGIN_LEFT, y, CONTENT_WIDTH, 4.5);
  y += 6;

  // Divider
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 10;

  // Sections
  for (const layer of populatedLayers) {
    // Section title
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(45, 40, 35);
    doc.text(layer.name, MARGIN_LEFT, y);
    y += 8;

    // Narrative (italic)
    if (layer.component) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(70, 65, 58);
      y = wrapAndRender(
        doc,
        layer.component.narrative,
        MARGIN_LEFT,
        y,
        CONTENT_WIDTH,
        4.5
      );
      y += 4;
    }

    // Patterns
    for (const pattern of layer.patterns) {
      y = checkPageBreak(doc, y, 16);

      // Pattern name (bold)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 50, 45);
      y = wrapAndRender(
        doc,
        pattern.name,
        MARGIN_LEFT + 4,
        y,
        CONTENT_WIDTH - 4,
        4.5
      );
      y += 1;

      // Pattern description
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(70, 65, 58);
      y = wrapAndRender(
        doc,
        pattern.description,
        MARGIN_LEFT + 4,
        y,
        CONTENT_WIDTH - 4,
        4.5
      );
      y += 4;
    }

    y += 6;
  }

  // CTA divider
  y = checkPageBreak(doc, y, 20);
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  // CTA
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 135, 128);
  const cta =
    "Mantle helps people build a guide to how they operate. If reading this made you curious about your own patterns, you can start yours at trustthemantle.com";
  y = wrapAndRender(doc, cta, MARGIN_LEFT, y, CONTENT_WIDTH, 4);

  // Footer on every page
  addFooter(doc, name);

  return doc.output("blob");
}
