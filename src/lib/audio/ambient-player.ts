let audio: HTMLAudioElement | null = null;
let currentTrack: string | null = null;
let fadeFrameId: number | null = null;

const TARGET_VOLUME = 0.3;

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
  }
  return audio;
}

function cancelFade() {
  if (fadeFrameId !== null) {
    cancelAnimationFrame(fadeFrameId);
    fadeFrameId = null;
  }
}

export function fadeIn(durationMs: number): Promise<void> {
  cancelFade();
  const el = ensureAudio();

  return new Promise((resolve) => {
    const start = performance.now();
    const startVolume = el.volume;

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      el.volume = startVolume + (TARGET_VOLUME - startVolume) * progress;

      if (progress < 1) {
        fadeFrameId = requestAnimationFrame(step);
      } else {
        fadeFrameId = null;
        resolve();
      }
    }

    fadeFrameId = requestAnimationFrame(step);
  });
}

export function fadeOut(durationMs: number): Promise<void> {
  cancelFade();
  const el = ensureAudio();

  return new Promise((resolve) => {
    const start = performance.now();
    const startVolume = el.volume;

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      el.volume = startVolume * (1 - progress);

      if (progress < 1) {
        fadeFrameId = requestAnimationFrame(step);
      } else {
        el.volume = 0;
        el.pause();
        fadeFrameId = null;
        resolve();
      }
    }

    fadeFrameId = requestAnimationFrame(step);
  });
}

export async function play(trackName: string): Promise<void> {
  const el = ensureAudio();

  if (currentTrack === trackName && !el.paused) {
    return;
  }

  if (currentTrack && currentTrack !== trackName && !el.paused) {
    await fadeOut(500);
  }

  currentTrack = trackName;
  el.src = `/audio/${trackName}.mp3`;
  el.volume = 0;
  await el.play();
  await fadeIn(1000);
}

export async function pause(): Promise<void> {
  if (!audio || audio.paused) return;
  await fadeOut(1000);
}

export async function resume(): Promise<void> {
  if (!audio || !currentTrack) return;
  await audio.play();
  await fadeIn(1000);
}

export function isPlaying(): boolean {
  return audio !== null && !audio.paused;
}

export function getCurrentTrack(): string | null {
  return currentTrack;
}
