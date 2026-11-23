import type { CutList } from "@saebyn/glowing-telegram-types";
import type {
  CutListIssue,
  FrameRate,
  MediaKind,
  Sequence,
  SequenceSource,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange, inSequenceOrder } from "./clipPlacements";
import { getProjectFrameCount } from "./frames";

export type ResolvedPlacement = {
  trackIndex: number;
  sequenceStartFrame: number;
  sequenceEndFrame: number;
  sourceInFrame: number;
  knownSourceEnd: number;
  mediaKind?: MediaKind;
  s3Location: string;
  sourceMappingKnown: boolean;
};

export type VisibleSpan = {
  start: number;
  end: number;
  placement: ResolvedPlacement;
  transitionIn?: CutList["outputTrack"][number]["transitionIn"];
  transitionOut?: CutList["outputTrack"][number]["transitionOut"];
};

export type ResolvedFade = {
  id: string;
  kind: "fade" | "dissolve";
  placement: ResolvedPlacement;
  edge: "entry" | "reveal";
  duration: number;
};

function isValidRate({ numerator, denominator }: FrameRate) {
  return (
    Number.isSafeInteger(numerator) &&
    numerator > 0 &&
    Number.isSafeInteger(denominator) &&
    denominator > 0
  );
}

/**
 * Flatten ordered tracks into spans of the uppermost placement.
 * Layout-only resolution allows missing media and mixed frame rates for authoring checks.
 */
export function resolveVisibleSequence(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
  layoutOnly = false,
) {
  const boundaries: { frame: number; trackIndex: number; placement?: ResolvedPlacement }[] = [];
  const fades: ResolvedFade[] = [];
  const issues: CutListIssue[] = [];
  const { durationFrames } = sequence;
  const validDuration = Number.isSafeInteger(durationFrames) && durationFrames >= 0;
  const validProjectRate = isValidRate(frameRate);
  if (!validDuration) issues.push({ code: "invalid-sequence-duration", durationFrames });
  if (!validProjectRate) issues.push({ code: "invalid-project-frame-rate", frameRate });
  let canResolveLayout = validDuration && validProjectRate;

  for (const [trackIndex, track] of sequence.tracks.entries()) {
    let trackEndFrame = 0;
    let previousPlacementId: string | undefined;
    for (const placement of inSequenceOrder(track.placements)) {
      const { id: placementId, sequenceStartFrame, entryTransition, revealTransition } = placement;
      const transitions = [
        ["entry", entryTransition],
        ["reveal", revealTransition],
      ] as const;
      const validTransitions = transitions.filter(([, transition]) => {
        if (!transition) return false;
        const { kind, durationFrames } = transition;
        if (
          (kind === "fade" || kind === "dissolve") &&
          Number.isSafeInteger(durationFrames) &&
          durationFrames > 0
        )
          return true;
        issues.push({ code: "invalid-transition", transitionId: transition.id });
        return false;
      });

      const validStart = Number.isSafeInteger(sequenceStartFrame) && sequenceStartFrame >= 0;
      if (!validStart) {
        issues.push({ code: "placement-outside-sequence", placementId });
        canResolveLayout = false;
      }
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) {
        issues.push({ code: "missing-clip", placementId, clipId: placement.clipId });
        canResolveLayout = false;
        continue;
      }
      const source = sources.find(({ id }) => id === clip.sourceId);
      if (!source && !layoutOnly)
        issues.push({ code: "missing-source", placementId, sourceId: clip.sourceId });
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
        clip,
        placement,
      );
      const validSourceRate = isValidRate(sourceFrameRate);
      const matchingRates =
        validSourceRate &&
        validProjectRate &&
        BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) ===
          BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator);
      if (!validSourceRate) {
        issues.push({ code: "invalid-source-frame-rate", placementId, sourceFrameRate });
      } else if (!layoutOnly && validProjectRate && !matchingRates) {
        issues.push({ code: "frame-rate-mismatch", placementId, sourceFrameRate });
      }
      const validRange =
        Number.isSafeInteger(sourceInFrame) &&
        Number.isSafeInteger(sourceOutFrame) &&
        sourceInFrame >= 0 &&
        sourceOutFrame > sourceInFrame &&
        (clip.sourceDurationFrames === undefined || sourceOutFrame <= clip.sourceDurationFrames);
      if (!validRange) {
        issues.push({ code: "invalid-source-range", placementId, sourceInFrame, sourceOutFrame });
      }
      if (!validStart || !validRange || !validSourceRate || !validProjectRate) {
        canResolveLayout = false;
        continue;
      }
      const frameCount = getProjectFrameCount(
        { sourceInFrame, sourceOutFrame, sourceFrameRate },
        frameRate,
      );
      const sequenceEndFrame = sequenceStartFrame + frameCount;
      if (
        !Number.isSafeInteger(sequenceEndFrame) ||
        (validDuration && sequenceEndFrame > durationFrames)
      ) {
        issues.push({ code: "placement-outside-sequence", placementId });
        canResolveLayout = false;
      }
      if (previousPlacementId !== undefined && sequenceStartFrame < trackEndFrame) {
        issues.push({ code: "track-overlap", trackId: track.id, placementId, previousPlacementId });
        canResolveLayout = false;
      }
      const resolved = {
        trackIndex,
        sequenceStartFrame,
        sequenceEndFrame,
        sourceInFrame,
        knownSourceEnd: clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame),
        mediaKind: source?.mediaKind,
        s3Location: source?.s3Location ?? clip.sourceId,
        sourceMappingKnown: source !== undefined && matchingRates,
      };
      for (const [edge, transition] of validTransitions) {
        if (!transition) continue;
        fades.push({
          id: transition.id,
          kind: transition.kind,
          placement: resolved,
          edge,
          duration: transition.durationFrames,
        });
      }

      boundaries.push(
        { frame: sequenceStartFrame, trackIndex, placement: resolved },
        { frame: sequenceEndFrame, trackIndex },
      );
      if (sequenceEndFrame > trackEndFrame) {
        trackEndFrame = sequenceEndFrame;
        previousPlacementId = placementId;
      }
    }
  }
  if (!canResolveLayout) return { issues, layout: null };

  // Stable sorting preserves end-before-start order for adjacent placements on a track.
  boundaries.sort((a, b) => a.frame - b.frame);
  const active: (ResolvedPlacement | undefined)[] = sequence.tracks.map(() => undefined);
  let visible: ResolvedPlacement | undefined;
  let cutStartFrame = 0;
  const gaps: { startFrame: number; endFrame: number }[] = [];
  const spans: VisibleSpan[] = [];
  for (const [index, { frame, trackIndex, placement }] of boundaries.entries()) {
    active[trackIndex] = placement;
    // Resolve priority after applying every change at this exclusive boundary.
    if (boundaries[index + 1]?.frame === frame) continue;
    const nextVisible = active.find((candidate) => candidate !== undefined);
    if (nextVisible === visible) continue;

    if (visible) spans.push({ start: cutStartFrame, end: frame, placement: visible });
    else if (frame > cutStartFrame) gaps.push({ startFrame: cutStartFrame, endFrame: frame });
    visible = nextVisible;
    cutStartFrame = frame;
  }
  if (cutStartFrame < sequence.durationFrames) {
    gaps.push({ startFrame: cutStartFrame, endFrame: sequence.durationFrames });
  }
  return { issues, layout: { spans, fades, gaps } };
}
