import type { ClipPlacement, FrameRate, Sequence, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";
import { getPlacementSourceRange } from "./sequence";

export type PlacementFadeField = keyof Pick<
  ClipPlacement,
  "entryTransitionFrames" | "revealTransitionFrames"
>;

export function getFadeBounds(sequence: Sequence, placementFrames: number) {
  return sequence.tracks.length === 1 && placementFrames > 0
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
  const track = sequence.tracks[0];
  const placement = track?.placements.find(({ id }) => id === placementId);
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
    tracks: [
      {
        ...track,
        placements: track.placements.map((other) =>
          other === placement ? { ...placement, [field]: duration } : other,
        ),
      },
    ],
  };
}
