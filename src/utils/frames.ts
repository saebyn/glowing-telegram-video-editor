import type { FrameRate, SequenceLayout, SourceRange, VideoClip } from "@/types";
import { formatSeconds, NANOSECONDS_PER_SECOND } from "./duration";

export function isValidFrameRate({ numerator, denominator }: FrameRate): boolean {
  return (
    Number.isSafeInteger(numerator) &&
    numerator > 0 &&
    Number.isSafeInteger(denominator) &&
    denominator > 0
  );
}

export function framesToSeconds(frames: number, rate: FrameRate): number {
  return (frames * rate.denominator) / rate.numerator;
}

/** Snap floating-point media seconds to the nearest frame. */
export function secondsToFrame(seconds: number, rate: FrameRate): number {
  return Math.round((seconds * rate.numerator) / rate.denominator);
}

/**
 * Convert an integer millisecond timestamp to the nearest frame, rounding ties up.
 * Throws RangeError if milliseconds is not a safe integer.
 */
export function millisecondsToFrame(milliseconds: number, rate: FrameRate): number {
  if (!Number.isSafeInteger(milliseconds)) {
    throw new RangeError("milliseconds must be a safe integer");
  }
  return nanosecondsToFrame(BigInt(milliseconds) * 1_000_000n, rate);
}

/** Snap exact elapsed metadata time to a frame, with ties toward the higher frame. */
export function nanosecondsToFrame(nanoseconds: bigint, rate: FrameRate): number {
  return roundFrameRatio(
    nanoseconds * BigInt(rate.numerator),
    NANOSECONDS_PER_SECOND * BigInt(rate.denominator),
  );
}

export function formatFrames(frames: number, rate: FrameRate): string {
  return formatSeconds(framesToSeconds(frames, rate));
}

/** Non-drop-frame timecode counts frames at the nominal project rate. */
export function formatTimecode(frame: number, rate: FrameRate): string {
  const nominalFps = Math.max(1, Math.round(rate.numerator / rate.denominator));
  const seconds = Math.floor(frame / nominalFps);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
    frame % nominalFps,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Clamp to the timeline, including its exclusive endpoint for out points. */
export function snapFrame(position: number, durationFrames: number): number {
  return Math.max(0, Math.min(durationFrames, Math.round(position)));
}

/** Rescale a signed integer offset without going through floating-point seconds. */
export function convertFrameOffset(offset: number, from: FrameRate, to: FrameRate): number {
  if (from.numerator === to.numerator && from.denominator === to.denominator) return offset;

  return roundFrameRatio(
    BigInt(offset) * BigInt(from.denominator) * BigInt(to.numerator),
    BigInt(from.numerator) * BigInt(to.denominator),
  );
}

function roundFrameRatio(numerator: bigint, divisor: bigint): number {
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
