import type { ClipPlacement, FrameRate, PlacementTransition, Sequence, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";
import { getPlacementSourceRange } from "./sequence";
import { getTrimmableSourceRange } from "./trimPlacement";

export type PlacementFadeField = keyof Pick<ClipPlacement, "entryTransition" | "revealTransition">;

export function getFadeBounds(placementFrames: number) {
  return placementFrames > 0 ? { min: 1, max: placementFrames } : null;
}

/** Find recorded owner footage used beyond the trim by an overlong anchored fade. */
export function getFadeSourceExtension(
  placement: ClipPlacement,
  field: PlacementFadeField,
  clip: VideoClip,
  projectRate: FrameRate,
  sequenceDuration: number,
) {
  const transition = placement[field];
  const range = getTrimmableSourceRange(placement, clip, projectRate);
  if (transition?.kind !== "fade" || !range) return null;

  const { sourceInFrame, sourceOutFrame } = range;
  const placementFrames = sourceOutFrame - sourceInFrame;
  const extra = transition.durationFrames - placementFrames;
  if (extra <= 0) return null;

  if (field === "entryTransition") {
    const knownSourceEnd =
      clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame);
    const endFrame = Math.min(
      sourceOutFrame + extra,
      knownSourceEnd,
      sourceInFrame + sequenceDuration - placement.sequenceStartFrame,
    );
    return endFrame > sourceOutFrame ? { startFrame: sourceOutFrame, endFrame } : null;
  }
  const startFrame = Math.max(0, sourceInFrame - Math.min(extra, placement.sequenceStartFrame));
  return startFrame < sourceInFrame ? { startFrame, endFrame: sourceInFrame } : null;
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
    placement[field]?.kind === "dissolve" ||
    duration === placement[field]?.durationFrames
  ) {
    return null;
  }
  const id = placement[field]?.id ?? allocateTransitionId();
  return replacePlacementTransition(sequence, placement, field, {
    id,
    kind: "fade",
    durationFrames: duration,
  });
}

export function replacePlacementTransition(
  sequence: Sequence,
  placement: ClipPlacement,
  field: PlacementFadeField,
  transition: PlacementTransition,
): Sequence {
  return {
    ...sequence,
    tracks: sequence.tracks.map((otherTrack) =>
      otherTrack.placements.includes(placement)
        ? {
            ...otherTrack,
            placements: otherTrack.placements.map((other) =>
              other === placement ? { ...placement, [field]: transition } : other,
            ),
          }
        : otherTrack,
    ),
  };
}
