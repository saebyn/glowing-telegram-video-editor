import type { FrameRate, SequenceLayout, SourceRange, VideoClip } from "@/types";
import { formatSeconds } from "./duration";

export function framesToSeconds(frames: number, rate: FrameRate): number {
  return (frames * rate.denominator) / rate.numerator;
}

/** Snap elapsed seconds to the nearest frame, with ties toward the higher frame. */
export function secondsToFrame(seconds: number, rate: FrameRate): number {
  return Math.round((seconds * rate.numerator) / rate.denominator);
}

export function formatFrames(frames: number, rate: FrameRate): string {
  return formatSeconds(framesToSeconds(frames, rate));
}

/** Clamp to the timeline, including its exclusive endpoint for out points. */
export function snapFrame(position: number, durationFrames: number): number {
  return Math.max(0, Math.min(durationFrames, Math.round(position)));
}

/** Rescale a signed integer offset without going through floating-point seconds. */
export function convertFrameOffset(offset: number, from: FrameRate, to: FrameRate): number {
  if (from.numerator === to.numerator && from.denominator === to.denominator) return offset;

  const numerator = BigInt(offset) * BigInt(from.denominator) * BigInt(to.numerator);
  const divisor = BigInt(from.numerator) * BigInt(to.denominator);
  // BigInt division truncates toward zero. Use a nonnegative remainder for rounding.
  const rest = numerator % divisor;
  const remainder = rest < 0n ? rest + divisor : rest;
  return Number((numerator - remainder) / divisor + (2n * remainder >= divisor ? 1n : 0n));
}

/** The output length of one clip, independent of its source or sequence position. */
export function getProjectFrameCount(range: SourceRange, projectFrameRate: FrameRate): number {
  const sourceCount = range.sourceOutFrame - range.sourceInFrame;
  return sourceCount > 0
    ? Math.max(1, convertFrameOffset(sourceCount, range.sourceFrameRate, projectFrameRate))
    : 0;
}

/** Lay out a gapless cutlist for both sequence UI and the host renderer. */
export function layoutSequence(clips: readonly VideoClip[], frameRate: FrameRate): SequenceLayout {
  let durationFrames = 0;
  const placements = clips.map((clip) => {
    const count = getProjectFrameCount(clip, frameRate);
    const placement = { clip, sequenceStartFrame: durationFrames, durationFrames: count };
    durationFrames += count;
    return placement;
  });
  return { frameRate, durationFrames, placements };
}
