/**
 * Lightweight regex-based detection of pasted transcripts.
 * Runs before Sage to conditionally load transcript-handling prompt sections.
 * Zero API cost — pure string matching.
 */

export interface TranscriptDetection {
  isTranscript: boolean;
  confidence: "high" | "medium" | "low";
  format?:
    | "speaker_alternating"
    | "email_thread"
    | "timestamped_chat"
    | "journal"
    | "unknown";
}

const NO_TRANSCRIPT: TranscriptDetection = {
  isTranscript: false,
  confidence: "low",
};

/**
 * Detects speaker-alternating patterns (iMessage, WhatsApp, Slack, etc.)
 * Requires 3+ speaker-labeled lines with 2+ distinct speakers at line starts.
 */
function detectSpeakerAlternating(lines: string[]): boolean {
  const speakerPattern = /^([A-Z][a-zA-Z\s]{0,20}):\s/;
  const speakers = new Set<string>();
  let speakerLineCount = 0;

  for (const line of lines) {
    const match = line.match(speakerPattern);
    if (match) {
      speakers.add(match[1].trim().toLowerCase());
      speakerLineCount++;
    }
  }

  return speakerLineCount >= 3 && speakers.size >= 2;
}

/**
 * Detects email thread formatting (headers, quoting, forwarded chains).
 */
function detectEmailThread(text: string, lines: string[]): boolean {
  let signals = 0;

  // From/To/Subject headers
  if (/^(From|To|Subject|Sent|Date):\s/m.test(text)) signals++;
  // "On [date] [person] wrote:" pattern
  if (/On .+ wrote:/i.test(text)) signals++;
  // Quote prefixes (3+ lines starting with >)
  const quotedLines = lines.filter((l) => l.trimStart().startsWith(">"));
  if (quotedLines.length >= 3) signals++;
  // Forwarded indicator
  if (/^-+\s*Forwarded/m.test(text)) signals++;

  return signals >= 2;
}

/**
 * Detects timestamped chat formatting ([HH:MM] or HH:MM AM/PM before names).
 */
function detectTimestampedChat(lines: string[]): boolean {
  const tsPattern =
    /^(\[?\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\]?\s*[-–]?\s*)/i;
  let tsLines = 0;

  for (const line of lines) {
    if (tsPattern.test(line.trim())) tsLines++;
  }

  return tsLines >= 3;
}

/**
 * Detects journal-style entries: long single-voice prose with date header
 * and paragraph structure. Requires 2+ paragraph breaks to avoid false
 * positives on long emotional messages.
 */
function detectJournal(text: string, wordCount: number): boolean {
  if (wordCount < 100) return false;

  // Date-like pattern in the first 100 characters
  const head = text.substring(0, 100);
  const hasDateHeader =
    /\b\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?\b/.test(head) ||
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i.test(
      head
    ) ||
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(head);

  if (!hasDateHeader) return false;

  // 2+ paragraph breaks (double newlines)
  const paragraphBreaks = (text.match(/\n\s*\n/g) || []).length;
  return paragraphBreaks >= 2;
}

export function detectTranscript(message: string): TranscriptDetection {
  if (!message || message.length < 100) return NO_TRANSCRIPT;

  const lines = message.split("\n").filter((l) => l.trim().length > 0);
  const wordCount = message.split(/\s+/).length;

  let signals = 0;
  let format: TranscriptDetection["format"] = undefined;

  // Check each format — email first since speaker pattern can false-positive on headers
  const isEmail = detectEmailThread(message, lines);
  if (isEmail) {
    signals++;
    format = "email_thread";
  }

  if (!isEmail && detectSpeakerAlternating(lines)) {
    signals++;
    format = "speaker_alternating";
  }

  if (detectTimestampedChat(lines)) {
    signals++;
    format = format || "timestamped_chat";
  }

  if (detectJournal(message, wordCount)) {
    signals++;
    format = format || "journal";
  }

  // Fallback: many short lines (chat-like structure)
  if (lines.length >= 10) {
    const avgLineLength =
      lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
    if (avgLineLength < 80) {
      signals++;
      format = format || "unknown";
    }
  }

  if (signals >= 2) {
    return { isTranscript: true, confidence: "high", format };
  }
  if (signals === 1) {
    return { isTranscript: true, confidence: "medium", format };
  }

  return NO_TRANSCRIPT;
}
