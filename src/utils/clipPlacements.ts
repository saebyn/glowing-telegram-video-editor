import type { ClipPlacement, SourceRange, VideoClip } from "@/types";

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

export function isValidSourceRange(
  { sourceInFrame, sourceOutFrame }: SourceRange,
  sourceDurationFrames: number | undefined,
): boolean {
  return (
    Number.isSafeInteger(sourceInFrame) &&
    Number.isSafeInteger(sourceOutFrame) &&
    sourceInFrame >= 0 &&
    sourceOutFrame > sourceInFrame &&
    (sourceDurationFrames === undefined || sourceOutFrame <= sourceDurationFrames)
  );
}

export function inSequenceOrder(placements: readonly ClipPlacement[]) {
  return [...placements].sort((a, b) => a.sequenceStartFrame - b.sequenceStartFrame);
}
