import { PERSONA_NAME } from "@/lib/persona/config";

export async function shareManual(
  pdfBlob: Blob,
  name: string
): Promise<void> {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const fileName = `${safeName}s_manual.pdf`;
  const file = new File([pdfBlob], fileName, { type: "application/pdf" });

  const shareText = `${name} shared their manual with you. This is a guide to how they work, written in their own words. Each entry was confirmed by them as accurate. You can ask ${PERSONA_NAME} questions about anything in this manual.`;

  // Try native share sheet (works on iOS Safari, Android Chrome, etc.)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const shareData: ShareData = { files: [file], text: shareText };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err: unknown) {
      // User cancelled share sheet — not an error, don't fall through to download
      if (err instanceof Error && err.name === "AbortError") return;
      // Any other error (NotAllowedError, etc.) — fall through to download
    }
  }

  // Fallback: direct PDF download
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
