import type { ClipPlacement, FrameRate, Sequence, SequenceSource, VideoClip } from "@/types";
import { replacePlacementTransition, type PlacementFadeField } from "./fadePlacement";
import { hasTransitionAuthoringConflict } from "./sequence";

export function evaluatePlacementDissolve(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
  placement: ClipPlacement,
  field: PlacementFadeField,
  duration: number,
  allocateTransitionId = () => crypto.randomUUID(),
) {
  const current = placement[field];
  if (
    !Number.isSafeInteger(duration) ||
    duration <= 0 ||
    duration === current?.durationFrames ||
    current?.kind === "fade"
  )
    return { kind: "unchanged" } as const;
  const id = current?.id ?? allocateTransitionId();
  const next = replacePlacementTransition(sequence, placement, field, {
    id,
    kind: "dissolve",
    durationFrames: duration,
  });
  if (hasTransitionAuthoringConflict(next, clips, sources, frameRate, id))
    return { kind: "conflict" } as const;
  return { kind: "edit", sequence: next } as const;
}
