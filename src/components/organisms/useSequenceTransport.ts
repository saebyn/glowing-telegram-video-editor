import { useEffect, useState } from "react";
import type { FrameRate } from "@/types";
import { secondsToFrame, snapFrame } from "@/utils/frames";

type Direction = 1 | -1;
type Playback = { direction: Direction; startFrame: number; startTime: number };

export function useSequenceTransport(durationFrames: number, frameRate: FrameRate) {
  const [frame, setFrame] = useState(0);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const playheadFrame = snapFrame(frame, durationFrames);
  // A host shrink replaces the stored position so later growth can't restore it.
  if (frame !== playheadFrame) setFrame(playheadFrame);

  useEffect(() => {
    if (!playback) return;
    let animationFrame: number;
    const tick = (time: number) => {
      const elapsedFrames = secondsToFrame((time - playback.startTime) / 1000, frameRate);
      const next = snapFrame(
        playback.startFrame + playback.direction * elapsedFrames,
        durationFrames,
      );
      setFrame(next);
      if (next === (playback.direction === 1 ? durationFrames : 0)) {
        setPlayback(null);
      } else {
        animationFrame = requestAnimationFrame(tick);
      }
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [durationFrames, frameRate, playback]);

  return {
    playheadFrame,
    isPlaying: playback !== null,
    seek(frame: number) {
      setPlayback(null);
      setFrame(snapFrame(frame, durationFrames));
    },
    play(direction: Direction) {
      setPlayback({ direction, startFrame: playheadFrame, startTime: performance.now() });
    },
    pause() {
      setPlayback(null);
    },
  };
}
