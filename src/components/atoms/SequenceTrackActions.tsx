export interface ToggleSequenceTrackLockProps {
  label: string;
  locked?: boolean;
  onToggle?: () => void;
}

export function ToggleSequenceTrackLock({ label, locked, onToggle }: ToggleSequenceTrackLockProps) {
  if (!onToggle)
    return locked ? <span className="absolute right-1 bottom-1 text-xs">Locked</span> : null;
  const action = locked ? "Unlock" : "Lock";
  return (
    <button
      type="button"
      className={`absolute right-1 bottom-1 rounded px-1 py-0.5 text-xs ${
        locked ? "bg-amber-200 text-amber-950" : "border border-slate-400"
      }`}
      aria-label={`${action} track: ${label}`}
      title={`${action} track`}
      onClick={onToggle}
    >
      {locked ? "Locked" : "Lock"}
    </button>
  );
}

export interface AddSequenceTrackProps {
  onAddTrack: () => void;
}

export function AddSequenceTrack({ onAddTrack }: AddSequenceTrackProps) {
  return (
    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={onAddTrack}>
      Add track
    </button>
  );
}

export interface RemoveSequenceTrackProps {
  label: string;
  onRemove: () => void;
}

export function RemoveSequenceTrack({ label, onRemove }: RemoveSequenceTrackProps) {
  return (
    <button
      type="button"
      className="absolute bottom-1 left-3 rounded border border-slate-400 p-1"
      aria-label={`Remove track: ${label}`}
      title="Remove track"
      onClick={onRemove}
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
