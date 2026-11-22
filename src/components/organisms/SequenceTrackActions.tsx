import type { Sequence, SequenceTrack } from "@/types";
import {
  addSequenceTrack,
  canRemoveSequenceTrack,
  removeSequenceTrack,
  toggleSequenceTrackLock,
} from "@/utils/sequenceTracks";

type TrackActionProps = {
  sequence: Sequence;
  onCommit: (next: Sequence) => void;
};

export function ToggleSequenceTrackLock({
  sequence,
  track,
  onCommit,
}: Omit<TrackActionProps, "onCommit"> & {
  track: SequenceTrack;
  onCommit?: (next: Sequence) => void;
}) {
  if (!onCommit)
    return track.locked ? <span className="absolute right-1 bottom-1 text-xs">Locked</span> : null;
  const action = track.locked ? "Unlock" : "Lock";
  return (
    <button
      type="button"
      className={`absolute right-1 bottom-1 rounded px-1 py-0.5 text-xs ${
        track.locked ? "bg-amber-200 text-amber-950" : "border border-slate-400"
      }`}
      aria-label={`${action} track: ${track.label}`}
      title={`${action} track`}
      onClick={() => {
        const next = toggleSequenceTrackLock(sequence, track.id);
        if (next) onCommit(next);
      }}
    >
      {track.locked ? "Locked" : "Lock"}
    </button>
  );
}

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
