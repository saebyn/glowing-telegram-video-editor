import { useId, useRef, useState } from "react";

export interface RenameSequenceTrackProps {
  tracks: readonly Readonly<{ id: string; label: string }>[];
  onRename: (trackId: string, label: string) => void;
}

export default function RenameSequenceTrack({ tracks, onRename }: RenameSequenceTrackProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [draft, setDraft] = useState<{ trackId: string; label: string }>();
  const first = tracks[0];
  if (!first && !draft) return null;
  const targetMissing = draft && !tracks.some(({ id }) => id === draft.trackId);

  return (
    <>
      <button
        type="button"
        className="rounded border px-3 py-1 text-sm"
        onClick={() => {
          if (!first) return;
          setDraft({ trackId: first.id, label: first.label });
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
            if (draft) onRename(draft.trackId, draft.label);
          }}
        >
          <label className="grid gap-1">
            Track
            <select
              className="rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-950"
              value={draft?.trackId ?? first?.id}
              onChange={(event) => {
                const target = tracks.find(({ id }) => id === event.currentTarget.value);
                if (target) setDraft({ trackId: target.id, label: target.label });
              }}
            >
              {targetMissing && (
                <option value={draft.trackId} disabled>
                  Track removed
                </option>
              )}
              {tracks.map(({ id, label }, index) => (
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
              value={draft?.label ?? ""}
              onChange={(event) => {
                if (draft) setDraft({ ...draft, label: event.currentTarget.value });
              }}
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
