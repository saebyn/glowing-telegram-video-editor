import { type PointerEvent, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Sequence } from "@/types";
import { canRemoveSequenceTrack, reorderSequenceTrack } from "@/utils/sequenceTracks";
import { RemoveSequenceTrack } from "./SequenceTrackActions";

type TrackHeadersProps = {
  sequence: Sequence;
  rulerHeight: number;
  rowHeight: number;
  onCommit?: (next: Sequence) => void;
};

type TrackDrag = { pointerId: number; id: string; origin: number };
type TrackPreview = { index: number; before: boolean };

export default function SequenceTrackHeaders({
  sequence,
  rulerHeight,
  rowHeight,
  onCommit,
}: TrackHeadersProps) {
  const { tracks } = sequence;
  const editable = onCommit !== undefined;
  const drag = useRef<TrackDrag | null>(null);
  const [preview, setPreview] = useState<TrackPreview | null>(null);

  const cancel = useCallback(() => {
    drag.current = null;
    setPreview(null);
  }, []);

  useLayoutEffect(() => {
    if (drag.current) cancel();
  }, [sequence, editable, cancel]);

  useLayoutEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !drag.current) return;
      event.preventDefault();
      cancel();
    }
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [cancel]);

  function proposedIndex(event: PointerEvent<HTMLDivElement>, origin: number) {
    const { left, right, top } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX >= right) return null;
    const index = Math.floor((event.clientY - top - rulerHeight) / rowHeight);
    return tracks[index] && index !== origin ? index : null;
  }

  function cancelPointer(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) cancel();
  }

  return (
    <div
      className="text-sm"
      onPointerMove={(event) => {
        const active = drag.current;
        if (active?.pointerId !== event.pointerId) return;
        const index = proposedIndex(event, active.origin);
        setPreview(index === null ? null : { index, before: index < active.origin });
      }}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={cancelPointer}
      onPointerUp={(event) => {
        const active = drag.current;
        if (active?.pointerId !== event.pointerId) return;
        const index = proposedIndex(event, active.origin);
        cancel();
        // A scroll or layout change may move the row under a stationary pointer.
        if (index === null || index !== preview?.index) return;
        const next = reorderSequenceTrack(sequence, active.id, index);
        if (next) onCommit?.(next);
      }}
    >
      <div className="flex items-center px-3 font-semibold" style={{ height: rulerHeight }}>
        {!preview ? (
          "Tracks"
        ) : (
          <output className="text-xs text-sky-200">
            Position {preview.index + 1} of {tracks.length}
          </output>
        )}
      </div>
      {tracks.map((track, index) => (
        <div
          key={track.id}
          // A track header groups timeline controls, not form fields.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
          aria-label={`Track: ${track.label}`}
          className={`relative flex items-center gap-1 border-t border-slate-600 pl-3 pr-1 ${
            onCommit && canRemoveSequenceTrack(sequence, track) ? "pb-6" : ""
          }`}
          style={{ height: rowHeight }}
        >
          <span className="min-w-0 flex-1 wrap-anywhere">{track.label}</span>
          {onCommit && tracks.length > 1 && (
            <button
              type="button"
              aria-label={`Reorder track: ${track.label}`}
              title="Drag to reorder track"
              className="size-6 shrink-0 cursor-grab touch-none rounded text-slate-200 hover:bg-slate-700 active:cursor-grabbing"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { pointerId: event.pointerId, id: track.id, origin: index };
              }}
            >
              <svg
                aria-hidden="true"
                className="mx-auto size-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 4h8M4 8h8M4 12h8" />
              </svg>
            </button>
          )}
          {preview?.index === index && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 z-10 h-1 bg-sky-300 ${
                preview.before ? "top-0" : "bottom-0"
              }`}
            />
          )}
          {onCommit && (
            <RemoveSequenceTrack sequence={sequence} track={track} onCommit={onCommit} />
          )}
        </div>
      ))}
    </div>
  );
}
