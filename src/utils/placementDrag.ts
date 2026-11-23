import type { ClipPlacement, FrameRate, Sequence, VideoClip } from "@/types";
import { getPlacementSourceRange, inSequenceOrder } from "./clipPlacements";
import { getProjectFrameCount } from "./frames";

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
  if (duration <= 0) return null;
  if (track.locked) {
    return {
      kind: "blocked",
      reason: "locked",
      sequenceStartFrame: atFrame,
      duration,
    } as const;
  }
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
  const moves = new Map<
    string,
    { placement: ClipPlacement; trackIndex: number | null; originIndex: number }
  >();
  for (const [index, track] of sequence.tracks.entries()) {
    for (const placement of track.placements) {
      if (!moving.has(placement.id)) continue;
      const trackIndex = trackShift === null ? null : index + trackShift;
      moves.set(placement.id, {
        placement: { ...placement, sequenceStartFrame: placement.sequenceStartFrame + frameOffset },
        trackIndex,
        originIndex: index,
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
  for (const { placement, trackIndex, originIndex: origin } of moves.values()) {
    if (trackIndex === null) return block("outside-tracks");
    const destination = sequence.tracks[trackIndex];
    if (!destination) return block("outside-tracks");
    const originTrack = sequence.tracks[origin];
    if (originTrack.locked || destination.locked) {
      return block("locked-track", originTrack.locked ? originTrack.id : destination.id);
    }
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
  | "locked-track"
  | "overlap";
type PlacementMoveResult = { destinations: PlacementMoveDestination[] } & (
  | { kind: "move"; sequence: Sequence }
  | { kind: "unchanged" }
  | { kind: "blocked"; reason: PlacementMoveBlockReason; trackId?: string }
);
