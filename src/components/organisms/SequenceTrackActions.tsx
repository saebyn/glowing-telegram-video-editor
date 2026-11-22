import type { Sequence, SequenceTrack } from "@/types";
import {
  addSequenceTrack,
  canRemoveSequenceTrack,
  removeSequenceTrack,
} from "@/utils/sequenceTracks";

type TrackActionProps = {
  sequence: Sequence;
  onCommit: (next: Sequence) => void;
};

export function AddSequenceTrack({ sequence, onCommit }: TrackActionProps) {
  return (
    <button
      type="button"
      className="rounded border px-3 py-1 text-sm"
      onClick={() => onCommit(addSequenceTrack(sequence, crypto.randomUUID()))}
    >
      Add track
    </button>
  );
}

export function RemoveSequenceTrack({
  sequence,
  track,
  onCommit,
}: TrackActionProps & { track: SequenceTrack }) {
  if (!canRemoveSequenceTrack(sequence, track)) return null;

  return (
    <button
      type="button"
      className="absolute bottom-1 left-3 rounded border border-slate-400 p-1"
      aria-label={`Remove track: ${track.label}`}
      title="Remove track"
      onClick={() => {
        const next = removeSequenceTrack(sequence, track.id);
        if (next) onCommit(next);
      }}
    >
      <svg
        aria-hidden="true"
        className="size-3"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 4h11M6 4V2h4v2m2 0-.75 10h-6.5L4 4" />
      </svg>
    </button>
  );
}
