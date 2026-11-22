import type { ClipPlacement, FrameRate, Sequence, VideoClip } from "@/types";
import { getPlacementSourceRange } from "./sequence";

function getSplitPoint(
  placement: ClipPlacement,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  playheadFrame: number,
) {
  if (!Number.isSafeInteger(playheadFrame)) return null;
  const clip = clips.find(({ id }) => id === placement.clipId);
  if (!clip) return null;

  const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
    clip,
    placement,
  );
  if (
    BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
    BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator)
  ) {
    return null;
  }

  const leftFrames = playheadFrame - placement.sequenceStartFrame;
  const sourceSplitFrame = sourceInFrame + leftFrames;
  if (leftFrames <= 0 || sourceSplitFrame >= sourceOutFrame) return null;
  return { clip, leftFrames, sourceSplitFrame, sourceOutFrame };
}

/** Check availability without allocating placement IDs. */
export function canSplitPlacementsAtPlayhead(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementIds: readonly string[],
  playheadFrame: number,
): boolean {
  const selected = new Set(placementIds);
  return sequence.tracks.some(({ placements }) =>
    placements.some(
      (placement) =>
        selected.has(placement.id) && getSplitPoint(placement, clips, frameRate, playheadFrame),
    ),
  );
}

/** Split the eligible selection in one edit, allocating an ID for each right half. */
export function splitPlacementsAtPlayhead(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementIds: readonly string[],
  playheadFrame: number,
  allocatePlacementId: () => string,
): Sequence | null {
  const selected = new Set(placementIds);
  let didSplit = false;
  const tracks = sequence.tracks.map((track) => {
    const placements = track.placements.flatMap((placement) => {
      if (!selected.has(placement.id)) return [placement];
      const split = getSplitPoint(placement, clips, frameRate, playheadFrame);
      if (!split) return [placement];
      const { clip, leftFrames, sourceSplitFrame, sourceOutFrame } = split;

      const { entryTransitionFrames, revealTransitionFrames, ...placementWithoutFades } = placement;
      return [
        {
          ...placementWithoutFades,
          sourceOutOffsetFrames: sourceSplitFrame - clip.sourceOutFrame,
          ...(entryTransitionFrames === undefined
            ? {}
            : { entryTransitionFrames: Math.min(entryTransitionFrames, leftFrames) }),
        },
        {
          ...placementWithoutFades,
          id: allocatePlacementId(),
          sequenceStartFrame: playheadFrame,
          sourceInOffsetFrames: sourceSplitFrame - clip.sourceInFrame,
          ...(revealTransitionFrames === undefined
            ? {}
            : {
                revealTransitionFrames: Math.min(
                  revealTransitionFrames,
                  sourceOutFrame - sourceSplitFrame,
                ),
              }),
        },
      ];
    });
    if (placements.length === track.placements.length) return track;
    didSplit = true;
    return { ...track, placements };
  });
  return didSplit ? { ...sequence, tracks } : null;
}
