import type { ClipPlacement, FrameRate, PlacementEdge, VideoClip } from "@/types";
import { transitionFields } from "./clipPlacements";
import { getTrimmableSourceRange } from "./trimPlacement";

/** Find recorded owner footage used beyond the trim by an overlong anchored fade. */
export function getFadeSourceExtension(
  placement: ClipPlacement,
  edge: PlacementEdge,
  clip: VideoClip,
  projectRate: FrameRate,
  sequenceDuration: number,
) {
  const transition = placement[transitionFields[edge]];
  const range = getTrimmableSourceRange(placement, clip, projectRate);
  if (transition?.kind !== "fade" || !range) return null;

  const { sourceInFrame, sourceOutFrame } = range;
  const placementFrames = sourceOutFrame - sourceInFrame;
  const extra = transition.durationFrames - placementFrames;
  if (extra <= 0) return null;

  if (edge === "leading") {
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
