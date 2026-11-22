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

export function canRemoveSequenceTrack(sequence: Sequence, track: SequenceTrack): boolean {
  return sequence.tracks.length > 1 && track.placements.length === 0;
}

export function removeSequenceTrack(sequence: Sequence, trackId: string): Sequence | null {
  const track = sequence.tracks.find(({ id }) => id === trackId);
  if (!track || !canRemoveSequenceTrack(sequence, track)) return null;
  return { ...sequence, tracks: sequence.tracks.filter(({ id }) => id !== trackId) };
}
