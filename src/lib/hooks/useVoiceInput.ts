"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type MicPermission = "not-requested" | "granted" | "denied";
export type RecordingState = "idle" | "starting" | "recording";

interface UseVoiceInputReturn {
  micPermission: MicPermission;
  recordingState: RecordingState;
  transcript: string;
  isInterim: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscript: () => void;
}

const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";
const MEDIA_RECORDER_TIMESLICE_MS = 250;

export function useVoiceInput(): UseVoiceInputReturn {
  const [micPermission, setMicPermission] = useState<MicPermission>("not-requested");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isInterim, setIsInterim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");
  const reconnectAttemptedRef = useRef(false);
  const tempKeyRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  // Latch: true from the first startRecording tap until stopRecording (or a
  // setup failure). A second concurrent pipeline transcribes the same audio
  // twice, so re-entrant starts must be no-ops.
  const activeRef = useRef(false);
  // Audio captured before the Deepgram socket opens, flushed once it does —
  // the first words spoken must not be lost to connection latency.
  const pendingChunksRef = useRef<Blob[]>([]);

  // Pre-check mic permission state on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (status.state === "granted") setMicPermission("granted");
        else if (status.state === "denied") setMicPermission("denied");
        // "prompt" → leave as "not-requested"

        // Listen for changes (user toggles in browser settings)
        status.onchange = () => {
          if (status.state === "granted") {
            setMicPermission("granted");
            setError(null);
          } else if (status.state === "denied") {
            setMicPermission("denied");
          } else {
            setMicPermission("not-requested");
          }
        };
      })
      .catch(() => {
        // Permissions API not available (e.g. Firefox for microphone)
        // Fall through to getUserMedia-based detection
      });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupAll() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    pendingChunksRef.current = [];
    activeRef.current = false;
  }

  async function fetchTempKey(): Promise<string | null> {
    try {
      const res = await fetch("/api/voice/token", { method: "POST" });
      if (!res.ok) {
        setError("Voice input unavailable");
        return null;
      }
      const data = await res.json();
      return data.key || null;
    } catch {
      setError("Voice input unavailable");
      return null;
    }
  }

  function connectWebSocket(key: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        model: "nova-2",
        language: "en",
        smart_format: "true",
        interim_results: "true",
        utterance_end_ms: "1500",
        endpointing: "300",
      });

      const ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params}`, ["token", key]);

      ws.onopen = () => {
        reconnectAttemptedRef.current = false;
        resolve(ws);
      };

      ws.onerror = (event) => {
        console.error("[voice] WebSocket connection failed:", event);
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        // If we're intentionally stopping, do nothing
        if (isStoppingRef.current) return;

        // Attempt one silent reconnect for mid-session drops
        if (activeRef.current && !reconnectAttemptedRef.current && tempKeyRef.current) {
          reconnectAttemptedRef.current = true;
          handleReconnect();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Ignore utterance end events (no auto-send)
          if (data.type === "UtteranceEnd") return;

          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;

          const text = alt.transcript || "";
          const isFinal = data.is_final === true;

          if (isFinal && text) {
            // Accumulate final transcript
            finalTranscriptRef.current =
              (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + text;
            setTranscript(finalTranscriptRef.current);
            setIsInterim(false);
          } else if (!isFinal && text) {
            // Show interim (final so far + interim chunk)
            const combined = finalTranscriptRef.current
              ? finalTranscriptRef.current + " " + text
              : text;
            setTranscript(combined);
            setIsInterim(true);
          }
        } catch {
          // Ignore malformed messages
        }
      };
    });
  }

  async function handleReconnect() {
    try {
      if (!tempKeyRef.current) return;
      const ws = await connectWebSocket(tempKeyRef.current);
      // ondataavailable reads wsRef, so pointing the ref at the new socket
      // is all the rewiring a live MediaRecorder needs.
      wsRef.current = ws;
    } catch {
      // Reconnect failed — stop recording and preserve transcript
      stopRecording();
      setError("Voice input disconnected — try again");
    }
  }

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setIsInterim(false);
  }, []);

  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;
    activeRef.current = false;
    pendingChunksRef.current = [];

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setRecordingState("idle");
    tempKeyRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    // A start already in flight (or a live recording) makes this tap a no-op.
    if (activeRef.current) return;
    activeRef.current = true;
    isStoppingRef.current = false;
    setError(null);

    // If we already know permission is denied, show helpful message immediately
    if (micPermission === "denied") {
      setError("Tap the lock icon in your address bar to enable microphone");
      activeRef.current = false;
      return;
    }

    setRecordingState("starting");

    // The two slowest setup steps — mic permission and the Deepgram key
    // round-trip — run in parallel.
    const keyPromise = fetchTempKey();

    // Get mic permission (must be direct user gesture on iOS Safari)
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicPermission("denied");
        setError("Tap the lock icon in your address bar to enable microphone");
      } else {
        setError("Could not access microphone");
      }
      setRecordingState("idle");
      activeRef.current = false;
      return;
    }

    if (isStoppingRef.current) {
      // User tapped stop while the permission prompt was up
      stream.getTracks().forEach((t) => t.stop());
      activeRef.current = false;
      return;
    }

    streamRef.current = stream;

    // Capture starts now; chunks buffer in pendingChunksRef until the socket
    // opens, then the ondataavailable handler flushes them in order.
    pendingChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        for (const chunk of pendingChunksRef.current) ws.send(chunk);
        pendingChunksRef.current = [];
        ws.send(event.data);
      } else {
        pendingChunksRef.current.push(event.data);
      }
    };

    recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
    finalTranscriptRef.current = "";
    setTranscript("");
    setIsInterim(false);
    setRecordingState("recording");

    const key = await keyPromise;
    if (isStoppingRef.current) return; // stopRecording already tore everything down
    if (!key) {
      // fetchTempKey set the user-facing error
      stopRecording();
      return;
    }
    tempKeyRef.current = key;

    // Connect WebSocket
    let ws: WebSocket;
    try {
      ws = await connectWebSocket(key);
    } catch (err) {
      console.error("[voice] Deepgram connection failed — API key may be expired or invalid:", err);
      if (isStoppingRef.current) return;
      setError("Could not connect to voice service");
      stopRecording();
      return;
    }
    if (isStoppingRef.current) {
      ws.close();
      return;
    }
    wsRef.current = ws;
    reconnectAttemptedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPermission]);

  return {
    micPermission,
    recordingState,
    transcript,
    isInterim,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
