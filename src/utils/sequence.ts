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

/** Move one placement without changing its source range or extending the sequence. */
export function movePlacement(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementId: string,
  sequenceStartFrame: number,
): Sequence | null {
  const [track] = sequence.tracks;
  const placement = track?.placements.find(({ id }) => id === placementId);
  if (
    !placement ||
    !Number.isSafeInteger(sequenceStartFrame) ||
    sequenceStartFrame < 0 ||
    sequenceStartFrame === placement.sequenceStartFrame
  ) {
    return null;
  }
  const clip = clips.find(({ id }) => id === placement.clipId);
  if (!clip) return null;
  const duration = getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate);
  const endFrame = sequenceStartFrame + duration;
  if (duration <= 0 || endFrame > sequence.durationFrames) return null;

  for (const other of track.placements) {
    if (other === placement || other.sequenceStartFrame >= endFrame) continue;
    const otherClip = clips.find(({ id }) => id === other.clipId);
    if (!otherClip) return null;
    const otherDuration = getProjectFrameCount(
      getPlacementSourceRange(otherClip, other),
      frameRate,
    );
    if (other.sequenceStartFrame + otherDuration > sequenceStartFrame) return null;
  }
  return {
    ...sequence,
    tracks: [
      {
        ...track,
        placements: track.placements.map((item) =>
          item === placement ? { ...placement, sequenceStartFrame } : item,
        ),
      },
    ],
  };
}

type ResolvedPlacement = {
  sequenceStartFrame: number;
  sourceInFrame: number;
  s3Location: string;
  entryTransitionFrames?: number;
  revealTransitionFrames?: number;
};

function isValidFadeDuration(duration: number | undefined, frameCount: number) {
  return (
    duration === undefined ||
    (Number.isSafeInteger(duration) && duration > 0 && duration <= frameCount)
  );
}

/** Compile fully covered edits at matching rates. Fades require one authored track. */
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
      const { sequenceStartFrame, entryTransitionFrames, revealTransitionFrames } = placement;
      if (sequenceStartFrame < trackEndFrame) return null;
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return null;
      const source = sources.find(({ id }) => id === clip.sourceId);
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
        clip,
        placement,
      );
      const frameCount = sourceOutFrame - sourceInFrame;
      const sequenceEndFrame = sequenceStartFrame + frameCount;
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
      // Reject unsupported fades here, before track priority can hide them.
      if (
        (sequence.tracks.length !== 1 &&
          (entryTransitionFrames !== undefined || revealTransitionFrames !== undefined)) ||
        !isValidFadeDuration(entryTransitionFrames, frameCount) ||
        !isValidFadeDuration(revealTransitionFrames, frameCount) ||
        (entryTransitionFrames ?? 0) + (revealTransitionFrames ?? 0) > frameCount
      ) {
        return null;
      }

      boundaries.push(
        {
          frame: sequenceStartFrame,
          trackIndex,
          placement: {
            sequenceStartFrame,
            sourceInFrame,
            s3Location: source.s3Location,
            entryTransitionFrames,
            revealTransitionFrames,
          },
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
      const {
        s3Location,
        sourceInFrame,
        sequenceStartFrame,
        entryTransitionFrames,
        revealTransitionFrames,
      } = visible;
      let mediaIndex = inputMedia.findIndex((media) => media.s3Location === s3Location);
      if (mediaIndex === -1) {
        mediaIndex = inputMedia.length;
        inputMedia.push({ s3Location, sections: [] });
      }
      const { sections } = inputMedia[mediaIndex];
      const section: CutList["outputTrack"][number] = { mediaIndex, sectionIndex: sections.length };
      if (entryTransitionFrames !== undefined) {
        section.transitionIn = { type: "fade", duration: entryTransitionFrames };
      }
      if (revealTransitionFrames !== undefined) {
        section.transitionOut = { type: "fade", duration: revealTransitionFrames };
      }
      output.push(section);
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
