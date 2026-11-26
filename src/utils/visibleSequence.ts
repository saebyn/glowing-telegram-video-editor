import type { CutList } from "@saebyn/glowing-telegram-types";
import type {
  CutListIssue,
  CutListSource,
  FrameRate,
  PlacementEdge,
  PlacementTransition,
  Sequence,
  SourcesById,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange, isValidSourceRange, transitionFields } from "./clipPlacements";
import { getProjectFrameCount, isValidFrameRate } from "./frames";
import { getSource } from "./sourcesById";

export type ResolvedPlacement = {
  trackIndex: number;
  sequenceStartFrame: number;
  sequenceEndFrame: number;
  sourceInFrame: number;
  sourceOutFrame: number;
  sourceFrameRate: FrameRate;
  sourceDurationFrames?: number;
  knownSourceEnd: number;
  sourceId: string;
  s3Location: string | undefined;
  sourceMappingKnown: boolean;
};

export type VisibleSpan = {
  start: number;
  end: number;
  placement: ResolvedPlacement;
  transitionIn?: CutList["outputTrack"][number]["transitionIn"];
  transitionOut?: CutList["outputTrack"][number]["transitionOut"];
};

export type ResolvedTransition = PlacementTransition & {
  placement: ResolvedPlacement;
  edge: PlacementEdge;
};

function isValidStart(frame: number) {
  return Number.isSafeInteger(frame) && frame >= 0;
}

/**
 * Resolve all authored placement geometry, or none of it if any placement is invalid.
 * Missing render media and mixed frame rates only prevent compilation, not editing.
 */
export function resolveSequencePlacements(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<CutListSource>,
  frameRate: FrameRate,
  layoutOnly = false,
) {
  const resolvedPlacements: ResolvedPlacement[] = [];
  const transitions: ResolvedTransition[] = [];
  const issues: CutListIssue[] = [];
  const validProjectRate = isValidFrameRate(frameRate);
  if (!validProjectRate) issues.push({ code: "invalid-project-frame-rate", frameRate });
  let canResolveLayout = validProjectRate;
  let durationFrames = 0;

  for (const [trackIndex, track] of sequence.tracks.entries()) {
    let trackEndFrame = 0;
    let previousPlacementId: string | undefined;
    const placements = [...track.placements].sort((a, b) => {
      // Invalid starts still get diagnostics, but must not disrupt the overlap scan.
      const startA = isValidStart(a.sequenceStartFrame) ? a.sequenceStartFrame : -1;
      const startB = isValidStart(b.sequenceStartFrame) ? b.sequenceStartFrame : -1;
      return startA - startB || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    for (const placement of placements) {
      const { id: placementId, sequenceStartFrame } = placement;
      const edges = ["leading", "trailing"] as const;
      const validTransitions = edges
        .map((edge) => [edge, placement[transitionFields[edge]]] as const)
        .filter(([, transition]) => {
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

      const validStart = isValidStart(sequenceStartFrame);
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
      const s3Location = getSource(sources, clip.sourceId)?.s3Location;
      const hasRenderReference = typeof s3Location === "string";
      if (!hasRenderReference && !layoutOnly)
        issues.push({ code: "missing-source", placementId, sourceId: clip.sourceId });
      const range = getPlacementSourceRange(clip, placement);
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = range;
      const validSourceRate = isValidFrameRate(sourceFrameRate);
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
      const validRange = isValidSourceRange(range, clip.sourceDurationFrames);
      if (!validRange) {
        issues.push({ code: "invalid-source-range", placementId, sourceInFrame, sourceOutFrame });
      }
      if (!validStart || !validRange || !validSourceRate || !validProjectRate) {
        canResolveLayout = false;
        continue;
      }
      const frameCount = getProjectFrameCount(range, frameRate);
      const sequenceEndFrame = sequenceStartFrame + frameCount;
      if (!Number.isSafeInteger(sequenceEndFrame)) {
        issues.push({ code: "placement-outside-sequence", placementId });
        canResolveLayout = false;
        continue;
      }
      if (previousPlacementId !== undefined && sequenceStartFrame < trackEndFrame) {
        issues.push({ code: "track-overlap", trackId: track.id, placementId, previousPlacementId });
        canResolveLayout = false;
      }
      if (sequenceEndFrame > trackEndFrame) {
        trackEndFrame = sequenceEndFrame;
        previousPlacementId = placementId;
      }
      durationFrames = Math.max(durationFrames, sequenceEndFrame);
      const resolved = {
        trackIndex,
        sequenceStartFrame,
        sequenceEndFrame,
        sourceInFrame,
        sourceOutFrame,
        sourceFrameRate,
        sourceDurationFrames: clip.sourceDurationFrames,
        knownSourceEnd: clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame),
        sourceId: clip.sourceId,
        s3Location: hasRenderReference ? s3Location : undefined,
        sourceMappingKnown: hasRenderReference && matchingRates,
      };
      for (const [edge, transition] of validTransitions) {
        if (!transition) continue;
        transitions.push({
          ...transition,
          placement: resolved,
          edge,
        });
      }

      resolvedPlacements.push(resolved);
    }
  }
  return {
    issues,
    geometry: canResolveLayout
      ? { durationFrames, placements: resolvedPlacements, transitions }
      : null,
  };
}

/**
 * Flatten ordered tracks into spans of the uppermost placement.
 * A source filter restricts the spans without skipping authored placement validation.
 */
export function resolveVisibleSequence(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<CutListSource>,
  frameRate: FrameRate,
  layoutOnly = false,
  includeSource?: (sourceId: string) => boolean,
) {
  const { issues, geometry } = resolveSequencePlacements(
    sequence,
    clips,
    sources,
    frameRate,
    layoutOnly,
  );
  if (!geometry) return { issues, layout: null };
  const { durationFrames, placements, transitions } = geometry;
  const boundaries = placements.flatMap((placement) => {
    const { trackIndex, sequenceStartFrame, sequenceEndFrame, sourceId } = placement;
    if (includeSource && !includeSource(sourceId)) return [];
    return [
      { frame: sequenceStartFrame, trackIndex, placement },
      { frame: sequenceEndFrame, trackIndex, placement: undefined },
    ];
  });

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
  if (cutStartFrame < durationFrames) {
    gaps.push({ startFrame: cutStartFrame, endFrame: durationFrames });
  }
  return {
    issues,
    layout: {
      durationFrames,
      placements,
      spans,
      gaps,
      transitions: includeSource
        ? transitions.filter(({ placement }) => includeSource(placement.sourceId))
        : transitions,
    },
  };
}
