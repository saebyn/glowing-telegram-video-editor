import type { CutList } from "@saebyn/glowing-telegram-types";
import type { ClipPlacement, FrameRate, Sequence, SequenceSource, VideoClip } from "@/types";
import { getProjectFrameCount } from "./frames";

export function getPlacementSourceRange(clip: VideoClip, placement: ClipPlacement) {
  return {
    sourceInFrame: clip.sourceInFrame + (placement.sourceInOffsetFrames ?? 0),
    sourceOutFrame: clip.sourceOutFrame + (placement.sourceOutOffsetFrames ?? 0),
    sourceFrameRate: clip.sourceFrameRate,
  };
}

function inSequenceOrder(placements: readonly ClipPlacement[]) {
  return [...placements].sort((a, b) => a.sequenceStartFrame - b.sequenceStartFrame);
}

/** Insert one clip into the uncovered gap under the pointer, if it fits without resizing. */
export function placeClipInGap(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  clipId: string,
  atFrame: number,
): Sequence | null {
  const [track] = sequence.tracks;
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (sequence.tracks.length !== 1 || !clip || atFrame < 0 || atFrame >= sequence.durationFrames) {
    return null;
  }

  const duration = getProjectFrameCount(clip, frameRate);
  let gapStart = 0;
  let gapEnd = sequence.durationFrames;
  const placements = inSequenceOrder(track.placements);
  for (const placement of placements) {
    if (atFrame < placement.sequenceStartFrame) {
      gapEnd = placement.sequenceStartFrame;
      break;
    }
    const placedClip = clips.find((candidate) => candidate.id === placement.clipId);
    if (!placedClip) return null;
    const range = getPlacementSourceRange(placedClip, placement);
    gapStart = Math.max(
      gapStart,
      placement.sequenceStartFrame + getProjectFrameCount(range, frameRate),
    );
  }
  if (atFrame < gapStart || duration <= 0 || gapEnd - gapStart < duration) return null;

  // Keep the entire clip in this gap, including when it is an exact fit.
  const sequenceStartFrame = Math.min(atFrame, gapEnd - duration);
  const placement: ClipPlacement = { id: crypto.randomUUID(), clipId, sequenceStartFrame };
  return { ...sequence, tracks: [{ ...track, placements: [...track.placements, placement] }] };
}

type ResolvedPlacement = {
  sequenceStartFrame: number;
  sourceInFrame: number;
  s3Location: string;
};

/** Compile fully covered, straight cuts at matching source and project rates. */
export function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
): CutList | null {
  const boundaries: { frame: number; trackIndex: number; placement?: ResolvedPlacement }[] = [];
  for (const [trackIndex, track] of sequence.tracks.entries()) {
    let trackEndFrame = 0;
    for (const placement of inSequenceOrder(track.placements)) {
      const { sequenceStartFrame } = placement;
      if (sequenceStartFrame < trackEndFrame || placement.entryTransitionFrames) return null;
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return null;
      const source = sources.find(({ id }) => id === clip.sourceId);
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
        clip,
        placement,
      );
      const sequenceEndFrame = sequenceStartFrame + (sourceOutFrame - sourceInFrame);
      if (
        !source ||
        BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
          BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator) ||
        sourceInFrame < 0 ||
        sourceOutFrame <= sourceInFrame ||
        (clip.sourceDurationFrames !== undefined && sourceOutFrame > clip.sourceDurationFrames) ||
        !(sequenceEndFrame <= sequence.durationFrames)
      ) {
        return null;
      }

      boundaries.push(
        {
          frame: sequenceStartFrame,
          trackIndex,
          placement: { sequenceStartFrame, sourceInFrame, s3Location: source.s3Location },
        },
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
  const inputMedia: CutList["inputMedia"] = [];
  const output: CutList["outputTrack"][number][] = [];
  for (const [index, { frame, trackIndex, placement }] of boundaries.entries()) {
    active[trackIndex] = placement;
    // Resolve priority after applying every change at this exclusive boundary.
    if (boundaries[index + 1]?.frame === frame) continue;
    const nextVisible = active.find((candidate) => candidate !== undefined);
    if (nextVisible === visible) continue;

    if (visible) {
      const { s3Location, sourceInFrame, sequenceStartFrame } = visible;
      let mediaIndex = inputMedia.findIndex((media) => media.s3Location === s3Location);
      if (mediaIndex === -1) {
        mediaIndex = inputMedia.length;
        inputMedia.push({ s3Location, sections: [] });
      }
      const { sections } = inputMedia[mediaIndex];
      output.push({ mediaIndex, sectionIndex: sections.length });
      sections.push({
        startFrame: sourceInFrame + (cutStartFrame - sequenceStartFrame),
        endFrame: sourceInFrame + (frame - sequenceStartFrame),
      });
    } else if (frame > cutStartFrame) {
      return null;
    }
    visible = nextVisible;
    cutStartFrame = frame;
  }
  const [first, ...rest] = output;
  if (!first || cutStartFrame !== sequence.durationFrames) return null;
  return { version: "1.0.0", inputMedia, outputTrack: [first, ...rest] };
}
