"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type MicPermission = "not-requested" | "granted" | "denied";
export type RecordingState = "idle" | "recording";

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
        if (
          recordingState === "recording" &&
          !reconnectAttemptedRef.current &&
          tempKeyRef.current
        ) {
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
      wsRef.current = ws;

      // Restart sending audio chunks if MediaRecorder is still active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
      }
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

  const startRecording = useCallback(async () => {
    setError(null);

    // If we already know permission is denied, show helpful message immediately
    if (micPermission === "denied") {
      setError("Tap the lock icon in your address bar to enable microphone");
      return;
    }

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
      return;
    }

    streamRef.current = stream;

    // Get temp Deepgram key
    const key = await fetchTempKey();
    if (!key) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    tempKeyRef.current = key;

    // Connect WebSocket
    let ws: WebSocket;
    try {
      ws = await connectWebSocket(key);
    } catch (err) {
      console.error("[voice] Deepgram connection failed — API key may be expired or invalid:", err);
      setError("Could not connect to voice service");
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    wsRef.current = ws;
    isStoppingRef.current = false;
    reconnectAttemptedRef.current = false;

    // Start MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
    setRecordingState("recording");
    finalTranscriptRef.current = "";
    setTranscript("");
    setIsInterim(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPermission]);

  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;

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
