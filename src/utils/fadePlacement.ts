import type { ClipPlacement, FrameRate, Sequence, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";
import { getPlacementSourceRange, hasMultipleOccupiedTracks } from "./sequence";

export type PlacementFadeField = keyof Pick<
  ClipPlacement,
  "entryTransitionFrames" | "revealTransitionFrames"
>;

export function getFadeBounds(sequence: Sequence, placementFrames: number) {
  return !hasMultipleOccupiedTracks(sequence) && placementFrames > 0
    ? { min: 1, max: placementFrames }
    : null;
}

/** Evaluate an authored fade independently of whether the sequence can compile. */
export function evaluatePlacementFade(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementId: string,
  field: PlacementFadeField,
  duration: number,
): Sequence | null {
  const track = sequence.tracks.find(({ placements }) => placements.length > 0);
  if (!track) return null;
  const placement = track.placements.find(({ id }) => id === placementId);
  const clip = clips.find(({ id }) => id === placement?.clipId);
  if (!placement || !clip) return null;
  const bounds = getFadeBounds(
    sequence,
    getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate),
  );
  if (
    !bounds ||
    !Number.isSafeInteger(duration) ||
    duration < bounds.min ||
    duration > bounds.max ||
    duration === placement[field]
  ) {
    return null;
  }
  return {
    ...sequence,
    tracks: sequence.tracks.map((otherTrack) =>
      otherTrack === track
        ? {
            ...track,
            placements: track.placements.map((other) =>
              other === placement ? { ...placement, [field]: duration } : other,
            ),
          }
        : otherTrack,
    ),
  };
}
