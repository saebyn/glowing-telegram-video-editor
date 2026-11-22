import type { ClipPlacement, FrameRate, Sequence, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";
import { getPlacementSourceRange } from "./sequence";

export type PlacementFadeField = keyof Pick<ClipPlacement, "entryTransition" | "revealTransition">;

export function getFadeBounds(placementFrames: number) {
  return placementFrames > 0 ? { min: 1, max: placementFrames } : null;
}

/** Evaluate an authored fade independently of whether the sequence can compile. */
export function evaluatePlacementFade(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementId: string,
  field: PlacementFadeField,
  duration: number,
  allocateTransitionId = () => crypto.randomUUID(),
): Sequence | null {
  const track = sequence.tracks.find(({ placements }) =>
    placements.some(({ id }) => id === placementId),
  );
  if (!track) return null;
  const placement = track.placements.find(({ id }) => id === placementId);
  const clip = clips.find(({ id }) => id === placement?.clipId);
  if (!placement || !clip) return null;
  const bounds = getFadeBounds(
    getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate),
  );
  if (
    !bounds ||
    !Number.isSafeInteger(duration) ||
    duration < bounds.min ||
    duration > bounds.max ||
    duration === placement[field]?.durationFrames
  ) {
    return null;
  }
  const id = placement[field]?.id ?? allocateTransitionId();
  return {
    ...sequence,
    tracks: sequence.tracks.map((otherTrack) =>
      otherTrack === track
        ? {
            ...track,
            placements: track.placements.map((other) =>
              other === placement
                ? { ...placement, [field]: { id, kind: "fade", durationFrames: duration } }
                : other,
            ),
          }
        : otherTrack,
    ),
  };
}
