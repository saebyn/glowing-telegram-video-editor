import type { Sequence, SequenceTrack } from "@/types";

export function addSequenceTrack(sequence: Sequence, id: string): Sequence {
  const labels = new Set(sequence.tracks.map(({ label }) => label));
  let number = 1;
  while (labels.has(`Track ${number}`)) number++;
  return {
    ...sequence,
    tracks: [{ id, label: `Track ${number}`, placements: [] }, ...sequence.tracks],
  };
}

export function findPlacementTrack(sequence: Sequence, placementId: string) {
  return sequence.tracks.find(({ placements }) => placements.some(({ id }) => id === placementId));
}

export function setSequenceTrackLocked(
  sequence: Sequence,
  trackId: string,
  locked: boolean,
): Sequence | null {
  const track = sequence.tracks.find(({ id }) => id === trackId);
  if (!track || !!track.locked === locked) return null;
  return {
    ...sequence,
    tracks: sequence.tracks.map((track) => (track.id === trackId ? { ...track, locked } : track)),
  };
}

export function canRemoveSequenceTrack(sequence: Sequence, track: SequenceTrack): boolean {
  return sequence.tracks.length > 1 && track.placements.length === 0;
}

export function removeSequenceTrack(sequence: Sequence, trackId: string): Sequence | null {
  const track = sequence.tracks.find(({ id }) => id === trackId);
  if (!track || !canRemoveSequenceTrack(sequence, track)) return null;
  return { ...sequence, tracks: sequence.tracks.filter(({ id }) => id !== trackId) };
}

/** Move a whole track to its final index in the top-first track list. */
export function reorderSequenceTrack(
  sequence: Sequence,
  trackId: string,
  destinationIndex: number,
): Sequence | null {
  const origin = sequence.tracks.findIndex(({ id }) => id === trackId);
  if (origin < 0 || origin === destinationIndex || !sequence.tracks[destinationIndex]) return null;
  const tracks = [...sequence.tracks];
  const [track] = tracks.splice(origin, 1);
  tracks.splice(destinationIndex, 0, track);
  return { ...sequence, tracks };
}
