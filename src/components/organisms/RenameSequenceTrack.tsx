import { useId, useRef, useState } from "react";
import type { Sequence } from "@/types";

interface RenameSequenceTrackProps {
  sequence: Sequence;
  onCommit: (next: Sequence) => void;
}

export default function RenameSequenceTrack({ sequence, onCommit }: RenameSequenceTrackProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [draft, setDraft] = useState<{ trackId: string; label?: string }>();
  const track = sequence.tracks.find(({ id }) => id === draft?.trackId) ?? sequence.tracks[0];
  if (!track) return null;
  const label = draft?.trackId === track.id ? (draft.label ?? track.label) : track.label;

  return (
    <>
      <button
        type="button"
        className="rounded border px-3 py-1 text-sm"
        onClick={() => {
          setDraft(undefined);
          dialog.current?.showModal();
        }}
      >
        Rename track
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        className="m-auto w-full max-w-sm rounded-lg border border-slate-400 bg-slate-50 p-4 text-slate-900 backdrop:bg-black/40 dark:bg-slate-900 dark:text-slate-100"
      >
        <h2 id={headingId} className="mb-3 text-lg font-semibold">
          Rename track
        </h2>
        <form
          className="grid gap-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            dialog.current?.close();
            if (label === track.label) return;
            onCommit({
              ...sequence,
              tracks: sequence.tracks.map((candidate) =>
                candidate.id === track.id ? { ...candidate, label } : candidate,
              ),
            });
          }}
        >
          <label className="grid gap-1">
            Track
            <select
              className="rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-950"
              value={track.id}
              onChange={(event) => setDraft({ trackId: event.currentTarget.value })}
            >
              {sequence.tracks.map(({ id, label }, index) => (
                <option key={id} value={id}>
                  {index + 1}. {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Track name
            <input
              className="rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-950"
              value={label}
              onChange={(event) =>
                setDraft({ trackId: track.id, label: event.currentTarget.value })
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="rounded border px-3 py-1">
              Save name
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
