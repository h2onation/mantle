"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import * as ambientPlayer from "@/lib/audio/ambient-player";

interface AudioContextValue {
  isPlaying: boolean;
  currentTrack: string | null;
  play: (trackName: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  const play = useCallback(async (trackName: string) => {
    await ambientPlayer.play(trackName);
    setCurrentTrack(trackName);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(async () => {
    await ambientPlayer.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    await ambientPlayer.resume();
    setIsPlaying(true);
  }, []);

  return (
    <AudioContext.Provider value={{ isPlaying, currentTrack, play, pause, resume }}>
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
