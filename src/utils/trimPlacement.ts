import type { ClipPlacement, FrameRate, Sequence, SequenceTrack, VideoClip } from "@/types";
import { getPlacementSourceRange } from "./clipPlacements";
import { getProjectFrameCount } from "./frames";

/** Trimming requires matching source and project frame rates. */
export function getTrimmableSourceRange(
  placement: ClipPlacement,
  clip: VideoClip,
  frameRate: FrameRate,
) {
  const range = getPlacementSourceRange(clip, placement);
  const { sourceFrameRate } = range;
  if (
    BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
    BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator)
  ) {
    return null;
  }
  return range;
}

/** Trailing trim keeps the start fixed. */
export function getTrailingTrimBounds(
  placement: ClipPlacement,
  track: SequenceTrack,
  clip: VideoClip,
  frameRate: FrameRate,
) {
  const range = getTrimmableSourceRange(placement, clip, frameRate);
  if (!range) return null;
  const { sourceInFrame, sourceOutFrame } = range;

  const maxSequenceEnd = track.placements.reduce(
    (end, other) =>
      other.sequenceStartFrame > placement.sequenceStartFrame
        ? Math.min(end, other.sequenceStartFrame)
        : end,
    Number.MAX_SAFE_INTEGER,
  );
  const min = sourceInFrame + 1;
  const sourceEnd = clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame);
  const max = Math.min(sourceEnd, sourceInFrame + (maxSequenceEnd - placement.sequenceStartFrame));
  return sourceInFrame < max ? { min, max, sourceInFrame, sourceOutFrame } : null;
}

/** Apply a trailing trim and any sequence growth as one edit. */
export function applyTrailingTrim(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementId: string,
  sourceOutFrame: number,
): Sequence | null {
  const track = sequence.tracks.find(({ placements }) =>
    placements.some(({ id }) => id === placementId),
  );
  const placement = track?.placements.find(({ id }) => id === placementId);
  const clip = clips.find(({ id }) => id === placement?.clipId);
  if (!track || track.locked || !placement || !clip) return null;

  const bounds = getTrailingTrimBounds(placement, track, clip, frameRate);
  if (
    !bounds ||
    !Number.isSafeInteger(sourceOutFrame) ||
    sourceOutFrame < bounds.min ||
    sourceOutFrame > bounds.max ||
    sourceOutFrame === bounds.sourceOutFrame
  ) {
    return null;
  }

  const endFrame = placement.sequenceStartFrame + (sourceOutFrame - bounds.sourceInFrame);
  const trimmed = { ...placement, sourceOutOffsetFrames: sourceOutFrame - clip.sourceOutFrame };
  return {
    ...sequence,
    durationFrames: Math.max(sequence.durationFrames, endFrame),
    tracks: sequence.tracks.map((candidate) =>
      candidate === track
        ? {
            ...track,
            placements: track.placements.map((other) => (other === placement ? trimmed : other)),
          }
        : candidate,
    ),
  };
}

/** A leading trim changes the source in point and sequence start by the same offset. */
export function applyLeadingTrim(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementId: string,
  sourceInFrame: number,
): Sequence | null {
  const track = sequence.tracks.find(({ placements }) =>
    placements.some(({ id }) => id === placementId),
  );
  const placement = track?.placements.find(({ id }) => id === placementId);
  const clip = clips.find(({ id }) => id === placement?.clipId);
  if (!track || track.locked || !placement || !clip) return null;

  const range = getTrimmableSourceRange(placement, clip, frameRate);
  if (
    !range ||
    !Number.isSafeInteger(sourceInFrame) ||
    sourceInFrame < 0 ||
    sourceInFrame >= range.sourceOutFrame ||
    sourceInFrame === range.sourceInFrame
  ) {
    return null;
  }

  const sequenceStartFrame = placement.sequenceStartFrame + (sourceInFrame - range.sourceInFrame);
  if (!Number.isSafeInteger(sequenceStartFrame) || sequenceStartFrame < 0) return null;

  for (const other of track.placements) {
    if (other.sequenceStartFrame >= placement.sequenceStartFrame) continue;
    const otherClip = clips.find(({ id }) => id === other.clipId);
    if (!otherClip) return null;
    const otherRange = getPlacementSourceRange(otherClip, other);
    const otherEnd = other.sequenceStartFrame + getProjectFrameCount(otherRange, frameRate);
    if (otherEnd > sequenceStartFrame) return null;
  }

  const trimmed = {
    ...placement,
    sequenceStartFrame,
    sourceInOffsetFrames: sourceInFrame - clip.sourceInFrame,
  };
  return {
    ...sequence,
    tracks: sequence.tracks.map((candidate) =>
      candidate === track
        ? {
            ...track,
            placements: track.placements.map((other) => (other === placement ? trimmed : other)),
          }
        : candidate,
    ),
  };
}
