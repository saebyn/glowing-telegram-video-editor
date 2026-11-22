import type { ClipPlacement, FrameRate, SequenceTrack, VideoClip } from "@/types";
import { getPlacementSourceRange } from "./sequence";

/** Trailing trim keeps the start fixed. This slice only edits straight cuts at matching rates. */
export function getTrailingTrimBounds(
  placement: ClipPlacement,
  track: SequenceTrack,
  clip: VideoClip,
  sequenceDuration: number,
  frameRate: FrameRate,
) {
  const range = getPlacementSourceRange(clip, placement);
  if (
    placement.entryTransitionFrames !== undefined ||
    BigInt(range.sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
      BigInt(frameRate.numerator) * BigInt(range.sourceFrameRate.denominator)
  ) {
    return null;
  }

  const nextCut = track.placements.reduce(
    (end, other) =>
      other.sequenceStartFrame > placement.sequenceStartFrame
        ? Math.min(end, other.sequenceStartFrame)
        : end,
    sequenceDuration,
  );
  const min = range.sourceInFrame + 1;
  const sourceEnd =
    clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, range.sourceOutFrame);
  const max = Math.min(sourceEnd, range.sourceInFrame + nextCut - placement.sequenceStartFrame);
  return min <= max ? { min, max, sourceOutFrame: range.sourceOutFrame } : null;
}
