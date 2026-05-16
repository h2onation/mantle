import React from "react";

export function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const parts: (string | React.ReactElement)[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;
    while ((match = regex.exec(para)) !== null) {
      if (match.index > lastIndex) {
        parts.push(para.slice(lastIndex, match.index));
      }
      parts.push(<strong key={keyIdx++}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < para.length) {
      parts.push(para.slice(lastIndex));
    }
    const withBreaks: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part === "string") {
        const lines = part.split("\n");
        lines.forEach((line, j) => {
          if (j > 0) withBreaks.push(<br key={`br-${keyIdx++}`} />);
          withBreaks.push(line);
        });
      } else {
        withBreaks.push(part);
      }
    }
    return (
      <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0 0" }}>
        {withBreaks}
      </p>
    );
  });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Strip the structural footer from a Jove checkpoint reflection — the
 * "Headline: XYZ" line (or a bare title line in that position) and the
 * trailing validation question ("What would you change or sharpen?",
 * "Where is this off?", etc.).
 *
 * Both elements were authored to scaffold the live moment. Once the user
 * has acted (refined / rejected / confirmed), the historical card already
 * shows the composed name as a heading at the top and the question is no
 * longer answerable — leaving them in renders as dead artifacts. Use
 * before rendering checkpoint message content in the historical plate.
 */
export function stripCheckpointFooter(content: string): string {
  if (!content) return content;
  let result = content.trimEnd();

  // Trailing validation question. Anchored at end-of-string and matched
  // case-insensitively to absorb minor model paraphrases.
  const questionRegex =
    /\n+[^\n]*\b(?:what would you (?:change|sharpen|adjust|tighten|tweak)|where is this off|where does this miss)[^\n]*\?\s*$/i;
  const questionMatch = result.match(questionRegex);
  if (questionMatch?.index !== undefined) {
    result = result.slice(0, questionMatch.index).trimEnd();
  }

  // Explicit "Headline: XYZ" prefix at end — strip regardless of whether
  // the question was present (it's unambiguous on its own).
  const headlinePrefixMatch = result.match(/\n+Headline\s*:\s*[^\n]+\s*$/i);
  if (headlinePrefixMatch?.index !== undefined) {
    result = result.slice(0, headlinePrefixMatch.index).trimEnd();
    return result;
  }

  // Bare headline (no "Headline:" prefix) is only safe to strip when we
  // saw the validation question — that confirms we're in the structural
  // footer. Without that anchor, a short last paragraph might just be a
  // closing sentence the user should still read.
  if (questionMatch) {
    const paragraphs = result.split(/\n{2,}/);
    if (paragraphs.length > 1) {
      const last = paragraphs[paragraphs.length - 1].trim();
      const wordCount = last.split(/\s+/).filter(Boolean).length;
      const looksLikeHeadline =
        wordCount >= 2 &&
        wordCount <= 12 &&
        last.length <= 100 &&
        !/[.!?]$/.test(last);
      if (looksLikeHeadline) {
        paragraphs.pop();
        result = paragraphs.join("\n\n").trimEnd();
      }
    }
  }

  return result;
}
