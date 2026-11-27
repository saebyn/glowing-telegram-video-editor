import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { FrameRate, SequencePreviewGate } from "@/types";
import { framesToSeconds, secondsToFrame, snapFrame } from "@/utils/frames";
import { previewSoundStops } from "@/utils/previewSoundStops";

type Direction = 1 | -1;
type Playback = { direction: Direction; startFrame: number; startTime: number };

export function useSequenceTransport(
  durationFrames: number,
  frameRate: FrameRate,
  enabled: boolean,
) {
  const preview = useRef<SequencePreviewGate>(null);
  const latest = useRef<{ durationFrames: number; playheadFrame: number } | null>(null);
  const registerPreview = useCallback((gate: SequencePreviewGate) => {
    preview.current = gate;
    return () => {
      if (preview.current === gate) preview.current = null;
    };
  }, []);
  const [frame, setFrame] = useState(0);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [stoppedOn, setStoppedOn] = useState<Direction>();
  const lastTick = useRef<{ playback: Playback; frame: number }>(null);
  const playheadFrame = frame;
  const transportStopped = !enabled || frame > durationFrames || durationFrames === 0;
  if (transportStopped) {
    if (playback) setPlayback(null);
    if (stoppedOn !== undefined) setStoppedOn(undefined);
  }

  useLayoutEffect(() => {
    latest.current = enabled ? { durationFrames, playheadFrame } : null;
    return () => {
      latest.current = null;
    };
  }, [enabled, durationFrames, playheadFrame]);

  useLayoutEffect(() => {
    if (!transportStopped) return;
    if (preview.current) previewSoundStops.get(preview.current)?.();
    if (!enabled) preview.current = null;
  }, [enabled, transportStopped]);

  useLayoutEffect(() => {
    if (transportStopped || !playback) return;
    let animationFrame: number;
    let { startFrame, startTime } = playback;
    if (lastTick.current?.playback === playback) {
      startFrame = snapFrame(lastTick.current.frame, durationFrames);
      startTime = performance.now();
    }
    let current = snapFrame(startFrame, durationFrames);
    let held = false;
    let activeGate: SequencePreviewGate | null = null;
    let soundCursor = current;
    const frameMillis = 1000 * framesToSeconds(1, frameRate);
    const tick = (time: number) => {
      const gate = preview.current;
      const direction = playback.direction;
      if (held || gate !== activeGate) {
        startFrame = current;
        startTime = time + (gate && direction === 1 ? 40 : 0);
        soundCursor = current;
        held = false;
        activeGate = gate;
      }
      const elapsedFrames = gate
        ? Math.max(0, Math.floor((time - startTime) / frameMillis))
        : secondsToFrame((time - startTime) / 1000, frameRate);
      const target = snapFrame(startFrame + direction * elapsedFrames, durationFrames);
      if (gate) {
        // Visit crossed frames even when the display refreshes more slowly
        // than the project's frame rate. Stop on the first unavailable frame.
        while (true) {
          const readiness = gate.readiness(current, direction);
          if (readiness === "failed") {
            setFrame(current);
            setStoppedOn(direction);
            setPlayback(null);
            return;
          }
          if (readiness === "loading") {
            held = true;
            break;
          }
          if (current === target) break;
          current += direction;
        }
        if (direction === 1 && !held) {
          // Queue ready sound ahead of the picture, not on the animation tick
          // for each individual block. Stop at the first missing contribution.
          while (soundCursor < durationFrames) {
            const delay = startTime + (soundCursor - startFrame) * frameMillis - time;
            if (delay > 100 || gate.readiness(soundCursor, 1) !== "ready") break;
            gate.presentSound?.(soundCursor, delay / 1000);
            soundCursor++;
          }
        }
      } else {
        current = target;
      }
      setFrame(current);
      lastTick.current = { playback, frame: current };
      if (!held && current === (direction === 1 ? durationFrames : 0)) {
        setPlayback(null);
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [durationFrames, frameRate, playback, transportStopped]);

  function play(direction: Direction) {
    const current = latest.current;
    if (!current) return;
    const startFrame = snapFrame(current.playheadFrame, current.durationFrames);
    setFrame(startFrame);
    if (direction === 1 ? startFrame >= current.durationFrames : startFrame <= 0) return;
    setStoppedOn(undefined);
    if (direction === 1) preview.current?.unlockSound?.();
    setPlayback({ direction, startFrame, startTime: performance.now() });
  }

  return {
    registerPreview,
    stoppedOn: enabled ? stoppedOn : undefined,
    playheadFrame,
    isPlaying: enabled && playback !== null,
    isReversing: enabled && playback?.direction === -1,
    seek(frame: number) {
      const current = latest.current;
      if (!current || !Number.isFinite(frame)) return;
      if (preview.current) previewSoundStops.get(preview.current)?.();
      setStoppedOn(undefined);
      setPlayback(null);
      setFrame(snapFrame(frame, current.durationFrames));
    },
    playForward: () => play(1),
    playReverse: () => play(-1),
    pause() {
      if (preview.current) previewSoundStops.get(preview.current)?.();
      setStoppedOn(undefined);
      setPlayback(null);
    },
  };
}
