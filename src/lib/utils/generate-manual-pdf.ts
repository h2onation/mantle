import jsPDF from "jspdf";
import type { Layer } from "@/components/mobile/manual/layer-definitions";

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 24;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

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
  const populatedLayers = layers.filter((l) => l.entries.length > 0);

  let y = MARGIN_TOP;

  // Branding — small, tasteful
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 155, 145);
  doc.text("Mantle", MARGIN_LEFT, y);
  y += 10;

  // Header
  doc.setFont("times", "normal");
  doc.setFontSize(26);
  doc.setTextColor(26, 22, 20);
  doc.text(`${name}'s Manual`, MARGIN_LEFT, y);
  y += 14;

  // Divider
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 10;

  // Sections
  for (const layer of populatedLayers) {
    // Section title
    y = checkPageBreak(doc, y, 20);
    doc.setFont("times", "normal");
    doc.setFontSize(16);
    doc.setTextColor(26, 22, 20);
    doc.text(layer.name, MARGIN_LEFT, y);
    y += 8;

    // Entries
    for (const entry of layer.entries) {
      y = checkPageBreak(doc, y, 16);

      // Entry name (bold)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 50, 45);
      y = wrapAndRender(
        doc,
        entry.name,
        MARGIN_LEFT + 4,
        y,
        CONTENT_WIDTH - 4,
        4.5
      );
      y += 1;

      // Entry content
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(74, 68, 64);
      y = wrapAndRender(
        doc,
        entry.content,
        MARGIN_LEFT + 4,
        y,
        CONTENT_WIDTH - 4,
        4.5
      );
      y += 4;
    }

    y += 6;
  }

  // Footer on last page only
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);

  // Footer divider
  const footerY = PAGE_HEIGHT - 20;
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, footerY, PAGE_WIDTH - MARGIN_RIGHT, footerY);

  // Footer text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(160, 155, 145);
  doc.text(
    "Built with Mantle \u2014 mantleapp.com",
    PAGE_WIDTH / 2,
    footerY + 6,
    { align: "center" }
  );

  return doc.output("blob");
}
