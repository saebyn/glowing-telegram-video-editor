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

/** Find the exact position and length of a pool clip before allocating a placement ID. */
export function evaluatePoolDrop(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  clipId: string,
  trackId: string,
  atFrame: number,
) {
  const track = sequence.tracks.find(({ id }) => id === trackId);
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (!track || !clip || !Number.isSafeInteger(atFrame) || atFrame < 0) {
    return null;
  }

  const duration = getProjectFrameCount(clip, frameRate);
  let gapStart = 0;
  let gapEnd = Infinity;
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
  if (duration <= 0) return null;
  if (atFrame < gapStart) {
    return { kind: "blocked", reason: "overlap", sequenceStartFrame: atFrame, duration } as const;
  }
  if (gapEnd - gapStart < duration) {
    return {
      kind: "blocked",
      reason: "gap-too-short",
      sequenceStartFrame: atFrame,
      duration,
    } as const;
  }

  // Backfit only when a later placement bounds the gap.
  const sequenceStartFrame = Math.min(atFrame, gapEnd - duration);
  const endFrame = sequenceStartFrame + duration;
  if (!Number.isSafeInteger(endFrame)) return null;
  return { kind: "place", sequenceStartFrame, duration } as const;
}

/** Insert a clip into a bounded gap or extend the sequence after the last placement. */
export function placeClipInGap(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  clipId: string,
  trackId: string,
  atFrame: number,
): Sequence | null {
  const drop = evaluatePoolDrop(sequence, clips, frameRate, clipId, trackId, atFrame);
  if (drop?.kind !== "place") return null;
  const { sequenceStartFrame, duration } = drop;
  const placement: ClipPlacement = { id: crypto.randomUUID(), clipId, sequenceStartFrame };
  return {
    ...sequence,
    durationFrames: Math.max(sequence.durationFrames, sequenceStartFrame + duration),
    tracks: sequence.tracks.map((other) =>
      other.id === trackId ? { ...other, placements: [...other.placements, placement] } : other,
    ),
  };
}

/** Move a selection by the grabbed placement's frame and track offsets.
 * A numeric destination is a track index, possibly beyond the existing tracks.
 */
export function evaluatePlacementMove(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  grabbedId: string,
  destinationTrack: string | number | null,
  sequenceStartFrame: number,
  placementIds: readonly string[] = [grabbedId],
): PlacementMoveResult {
  const originIndex = sequence.tracks.findIndex((track) =>
    track.placements.some(({ id }) => id === grabbedId),
  );
  const matchingIndex = sequence.tracks.findIndex(({ id }) => id === destinationTrack);
  const destinationIndex =
    typeof destinationTrack === "number"
      ? destinationTrack
      : matchingIndex >= 0
        ? matchingIndex
        : null;
  const grabbed = sequence.tracks[originIndex]?.placements.find(({ id }) => id === grabbedId);
  const moving = new Set(placementIds);
  if (!grabbed || !moving.has(grabbedId) || !Number.isSafeInteger(sequenceStartFrame)) {
    return { kind: "blocked", reason: "invalid-placement", destinations: [] };
  }
  const trackShift = destinationIndex === null ? null : destinationIndex - originIndex;
  const frameOffset = sequenceStartFrame - grabbed.sequenceStartFrame;
  const moves = new Map<string, { placement: ClipPlacement; trackIndex: number | null }>();
  for (const [index, track] of sequence.tracks.entries()) {
    for (const placement of track.placements) {
      if (!moving.has(placement.id)) continue;
      const trackIndex = trackShift === null ? null : index + trackShift;
      moves.set(placement.id, {
        placement: { ...placement, sequenceStartFrame: placement.sequenceStartFrame + frameOffset },
        trackIndex,
      });
    }
  }
  const destinations = Array.from(moves, ([placementId, { placement, trackIndex }]) => ({
    placementId,
    trackIndex,
    sequenceStartFrame: placement.sequenceStartFrame,
  }));
  const block = (reason: PlacementMoveBlockReason, trackId?: string): PlacementMoveResult => ({
    kind: "blocked",
    reason,
    destinations,
    trackId,
  });
  if (moves.size !== moving.size) return block("invalid-placement");
  if (destinationIndex === null || !sequence.tracks[destinationIndex])
    return block("outside-tracks");
  if (trackShift === 0 && frameOffset === 0) return { kind: "unchanged", destinations };

  let durationFrames = sequence.durationFrames;
  const arrivals = sequence.tracks.map((): ClipPlacement[] => []);
  for (const { placement, trackIndex } of moves.values()) {
    if (trackIndex === null) return block("outside-tracks");
    const destination = sequence.tracks[trackIndex];
    if (!destination) return block("outside-tracks");
    const start = placement.sequenceStartFrame;
    if (start < 0) return block("negative-frame");
    const clip = clips.find(({ id }) => id === placement.clipId);
    if (!clip) return block("invalid-placement");
    const duration = getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate);
    const end = start + duration;
    if (duration <= 0 || !Number.isSafeInteger(end)) return block("invalid-placement");

    for (const other of destination.placements) {
      if (moving.has(other.id) || other.sequenceStartFrame >= end) continue;
      const otherClip = clips.find(({ id }) => id === other.clipId);
      if (!otherClip) return block("invalid-placement");
      const otherDuration = getProjectFrameCount(
        getPlacementSourceRange(otherClip, other),
        frameRate,
      );
      if (other.sequenceStartFrame + otherDuration > start) return block("overlap", destination.id);
    }
    durationFrames = Math.max(durationFrames, end);
    arrivals[trackIndex].push(placement);
  }

  return {
    kind: "move",
    destinations,
    sequence: {
      ...sequence,
      durationFrames,
      tracks: sequence.tracks.map((track, index) => ({
        ...track,
        placements:
          trackShift === 0
            ? track.placements.map((placement) => moves.get(placement.id)?.placement ?? placement)
            : [...track.placements.filter(({ id }) => !moving.has(id)), ...arrivals[index]],
      })),
    },
  };
}

type PlacementMoveDestination = {
  placementId: string;
  trackIndex: number | null;
  sequenceStartFrame: number;
};
type PlacementMoveBlockReason =
  | "outside-tracks"
  | "negative-frame"
  | "invalid-placement"
  | "overlap";
export type PlacementMoveResult = { destinations: PlacementMoveDestination[] } & (
  | { kind: "move"; sequence: Sequence }
  | { kind: "unchanged" }
  | { kind: "blocked"; reason: PlacementMoveBlockReason; trackId?: string }
);

type ResolvedPlacement = {
  sequenceStartFrame: number;
  sequenceEndFrame: number;
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

export function hasMultipleOccupiedTracks(sequence: Sequence) {
  return sequence.tracks.filter(({ placements }) => placements.length > 0).length > 1;
}

/** Compile fully covered edits at matching rates. */
export function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
): CutList | null {
  const boundaries: { frame: number; trackIndex: number; placement?: ResolvedPlacement }[] = [];
  // A fade whose authored edge is hidden must not silently disappear from the output.
  let remainingFades = 0;
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
      if (
        !isValidFadeDuration(entryTransitionFrames, frameCount) ||
        !isValidFadeDuration(revealTransitionFrames, frameCount) ||
        (entryTransitionFrames ?? 0) + (revealTransitionFrames ?? 0) > frameCount
      ) {
        return null;
      }
      if (entryTransitionFrames !== undefined) remainingFades++;
      if (revealTransitionFrames !== undefined) remainingFades++;

      boundaries.push(
        {
          frame: sequenceStartFrame,
          trackIndex,
          placement: {
            sequenceStartFrame,
            sequenceEndFrame,
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
        sequenceEndFrame,
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
      if (entryTransitionFrames !== undefined && cutStartFrame === sequenceStartFrame) {
        if (frame - cutStartFrame < entryTransitionFrames) return null;
        section.transitionIn = { type: "fade", duration: entryTransitionFrames };
        remainingFades--;
      }
      if (revealTransitionFrames !== undefined && frame === sequenceEndFrame) {
        if (frame - cutStartFrame < revealTransitionFrames) return null;
        section.transitionOut = { type: "fade", duration: revealTransitionFrames };
        remainingFades--;
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
  if (!first || cutStartFrame !== sequence.durationFrames || remainingFades !== 0) return null;
  return { version: "1.0.0", inputMedia, outputTrack: [first, ...rest] };
}
