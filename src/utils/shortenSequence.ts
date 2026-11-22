import type { FrameRate, Sequence, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";
import { getPlacementSourceRange } from "./sequence";

export function shortenSequence(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  endFrame: number,
): Sequence | null {
  if (!Number.isSafeInteger(endFrame) || endFrame < 0 || endFrame >= sequence.durationFrames)
    return null;

  for (const track of sequence.tracks) {
    for (const placement of track.placements) {
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return null;
      const duration = getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate);
      if (placement.sequenceStartFrame + duration > endFrame) return null;
    }
  }
  return { ...sequence, durationFrames: endFrame };
}
