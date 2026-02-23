"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import * as ambientPlayer from "@/lib/audio/ambient-player";

interface AudioContextValue {
  isPlaying: boolean;
  currentTrack: string | null;
  autoplayBlocked: boolean;
  play: (trackName: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  resumeAutoplay: () => Promise<void>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const didAttemptAutoResume = useRef(false);

  const play = useCallback(async (trackName: string) => {
    localStorage.setItem("mantle_session_sound", trackName);
    await ambientPlayer.play(trackName);
    setCurrentTrack(trackName);
    setIsPlaying(true);
    setAutoplayBlocked(false);
  }, []);

  const pause = useCallback(async () => {
    await ambientPlayer.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    await ambientPlayer.resume();
    setIsPlaying(true);
  }, []);

  const stop = useCallback(async () => {
    await ambientPlayer.pause();
    localStorage.removeItem("mantle_session_sound");
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  const resumeAutoplay = useCallback(async () => {
    const saved = localStorage.getItem("mantle_session_sound");
    if (!saved) return;
    try {
      await ambientPlayer.play(saved);
      setCurrentTrack(saved);
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch {
      // Still blocked, do nothing
    }
  }, []);

  // Auto-resume from localStorage on mount
  useEffect(() => {
    if (didAttemptAutoResume.current) return;
    didAttemptAutoResume.current = true;

    const saved = localStorage.getItem("mantle_session_sound");
    if (!saved) return;

    // Set the track name so the UI shows correctly
    setCurrentTrack(saved);

    let mounted = true;
    ambientPlayer.play(saved).then(() => {
      if (mounted) setIsPlaying(true);
    }).catch(() => {
      // Autoplay was blocked by the browser
      if (mounted) setAutoplayBlocked(true);
    });

    return () => { mounted = false; };
  }, []);

  return (
    <AudioContext.Provider value={{
      isPlaying,
      currentTrack,
      autoplayBlocked,
      play,
      pause,
      resume,
      stop,
      resumeAutoplay,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return ctx;
}
