import type { CutList } from "@saebyn/glowing-telegram-types";
import type { FrameRate, MediaKind, Sequence, SequenceSource, VideoClip } from "@/types";
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
  for (const [trackIndex, track] of sequence.tracks.entries()) {
    let trackEndFrame = 0;
    for (const placement of inSequenceOrder(track.placements)) {
      const { sequenceStartFrame, entryTransition, revealTransition } = placement;
      if (sequenceStartFrame < trackEndFrame) return null;
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return null;
      const source = sources.find(({ id }) => id === clip.sourceId);
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
        clip,
        placement,
      );
      const frameCount = layoutOnly
        ? getProjectFrameCount({ sourceInFrame, sourceOutFrame, sourceFrameRate }, frameRate)
        : sourceOutFrame - sourceInFrame;
      const sequenceEndFrame = sequenceStartFrame + frameCount;
      if (
        (!layoutOnly &&
          (!source ||
            BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
              BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator))) ||
        frameCount <= 0 ||
        sourceInFrame < 0 ||
        sourceOutFrame <= sourceInFrame ||
        (clip.sourceDurationFrames !== undefined && sourceOutFrame > clip.sourceDurationFrames) ||
        !(sequenceEndFrame <= sequence.durationFrames)
      ) {
        return null;
      }
      const resolved = {
        trackIndex,
        sequenceStartFrame,
        sequenceEndFrame,
        sourceInFrame,
        knownSourceEnd: clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame),
        mediaKind: source?.mediaKind,
        s3Location: source?.s3Location ?? clip.sourceId,
      };
      for (const [edge, transition] of [
        ["entry", entryTransition],
        ["reveal", revealTransition],
      ] as const) {
        if (!transition) continue;
        const duration = transition.durationFrames;
        if (
          (transition.kind !== "fade" && transition.kind !== "dissolve") ||
          !Number.isSafeInteger(duration) ||
          duration <= 0
        ) {
          return null;
        }
        fades.push({
          id: transition.id,
          kind: transition.kind,
          placement: resolved,
          edge,
          duration,
        });
      }

      boundaries.push(
        { frame: sequenceStartFrame, trackIndex, placement: resolved },
        { frame: sequenceEndFrame, trackIndex },
      );
      trackEndFrame = sequenceEndFrame;
    }
  }

  // Stable sorting preserves end-before-start order for adjacent placements on a track.
  boundaries.sort((a, b) => a.frame - b.frame);
  const active: (ResolvedPlacement | undefined)[] = sequence.tracks.map(() => undefined);
  let visible: ResolvedPlacement | undefined;
  let cutStartFrame = 0;
  let hasGap = false;
  const spans: VisibleSpan[] = [];
  for (const [index, { frame, trackIndex, placement }] of boundaries.entries()) {
    active[trackIndex] = placement;
    // Resolve priority after applying every change at this exclusive boundary.
    if (boundaries[index + 1]?.frame === frame) continue;
    const nextVisible = active.find((candidate) => candidate !== undefined);
    if (nextVisible === visible) continue;

    if (visible) spans.push({ start: cutStartFrame, end: frame, placement: visible });
    else if (frame > cutStartFrame) hasGap = true;
    visible = nextVisible;
    cutStartFrame = frame;
  }
  return { spans, fades, hasGap: hasGap || cutStartFrame !== sequence.durationFrames };
}
