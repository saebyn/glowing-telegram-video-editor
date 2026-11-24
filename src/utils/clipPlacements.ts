import type { ClipPlacement, VideoClip } from "@/types";

export const transitionFields = {
  leading: "transitionIn",
  trailing: "transitionOut",
} as const;

export function getPlacementSourceRange(clip: VideoClip, placement: ClipPlacement) {
  return {
    sourceInFrame: clip.sourceInFrame + (placement.sourceInOffsetFrames ?? 0),
    sourceOutFrame: clip.sourceOutFrame + (placement.sourceOutOffsetFrames ?? 0),
    sourceFrameRate: clip.sourceFrameRate,
  };
}

export function inSequenceOrder(placements: readonly ClipPlacement[]) {
  return [...placements].sort((a, b) => a.sequenceStartFrame - b.sequenceStartFrame);
}
