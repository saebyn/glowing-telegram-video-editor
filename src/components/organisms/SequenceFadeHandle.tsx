import { type PointerEvent, useId, useLayoutEffect, useRef, useState } from "react";
export type SequenceFadeHandleProps = {
  label: string;
  edge: "entry" | "reveal";
  frames: number;
  placementFrames: number;
  pixelsPerFrame: number;
  selected?: boolean;
  onSelect?: () => void;
  edit?: {
    evaluate: (frames: number) => "valid" | "blocked" | "conflict";
    commit: (frames: number) => void;
    locked?: boolean;
  };
};

export default function SequenceFadeHandle({
  label,
  edge,
  frames,
  placementFrames,
  pixelsPerFrame,
  selected,
  onSelect,
  edit,
}: SequenceFadeHandleProps) {
  const drag = useRef<{ pointerId: number; x: number } | null>(null);
  const [draft, setDraft] = useState<number | "blocked" | "conflict" | null>(null);
  const feedbackId = useId();
  const blocked = draft === "blocked" || draft === "conflict";
  const percent = Math.min(
    100,
    (100 * (typeof draft === "number" ? draft : frames)) / placementFrames,
  );
  const isEntry = edge === "entry";
  const styleEdge = isEntry ? "left" : "right";
  const name = `Adjust ${edge} fade: ${label}`;
  const Indicator = onSelect ? "button" : "span";

  // The draft is relative to the authored fade and the scale at pointerdown.
  useLayoutEffect(() => {
    if (!drag.current) return;
    drag.current = null;
    setDraft(null);
  }, [frames, placementFrames, pixelsPerFrame]);

  function clearDrag() {
    drag.current = null;
    setDraft(null);
  }

  function proposedFrames(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const origin = drag.current;
    return origin?.pointerId === event.pointerId
      ? frames + Math.round(((event.clientX - origin.x) * (isEntry ? 1 : -1)) / pixelsPerFrame)
      : null;
  }

  return (
    <>
      {(percent > 0 || onSelect) && (
        <Indicator
          type={onSelect ? "button" : undefined}
          aria-label={onSelect ? `Select ${edge} fade: ${label}` : undefined}
          aria-pressed={onSelect ? selected : undefined}
          className={`absolute h-3 overflow-hidden bg-amber-300 indent-1 text-left text-[9px]/3 font-semibold whitespace-nowrap text-amber-950 ${isEntry ? "top-0 rounded-r" : "top-3 rounded-l"} ${
            onSelect
              ? "min-w-1 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 aria-pressed:bg-amber-500 aria-pressed:inset-ring-2 aria-pressed:inset-ring-amber-900"
              : "pointer-events-none"
          }`}
          style={{ [styleEdge]: 0, width: `${percent}%` }}
          onPointerDown={onSelect ? (event) => event.stopPropagation() : undefined}
          onClick={
            onSelect
              ? (event) => {
                  event.stopPropagation();
                  onSelect();
                }
              : undefined
          }
        >
          {isEntry ? "Fade in" : "Fade out"}
        </Indicator>
      )}
      {edit && (
        <button
          type="button"
          aria-label={name}
          aria-describedby={blocked ? feedbackId : undefined}
          data-state={blocked ? "blocked" : undefined}
          title={name}
          // Keep the center of each indicator clickable, even for a one-frame fade.
          className={`absolute z-10 h-2 w-3 cursor-ew-resize touch-none overflow-hidden rounded-sm border border-amber-100 bg-amber-700 text-[8px]/[6px] font-bold text-white select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white data-[state=blocked]:bg-rose-700 ${isEntry ? "top-2 -translate-x-1/2" : "top-5 translate-x-1/2"}`}
          style={{ [styleEdge]: `clamp(6px, ${percent}%, calc(100% - 6px))` }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!event.isPrimary || event.button !== 0) return;
            drag.current = { pointerId: event.pointerId, x: event.clientX };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const next = proposedFrames(event);
            if (next === null) return;
            if (next === frames) {
              setDraft(null);
              return;
            }
            const evaluated = edit.evaluate(next);
            setDraft(evaluated === "valid" ? next : evaluated);
          }}
          onPointerUp={(event) => {
            const next = proposedFrames(event);
            if (next === null) return;
            clearDrag();
            edit.commit(next);
          }}
          onPointerCancel={(event) => {
            event.stopPropagation();
            if (drag.current?.pointerId === event.pointerId) clearDrag();
          }}
          onLostPointerCapture={(event) => {
            event.stopPropagation();
            if (drag.current?.pointerId === event.pointerId) clearDrag();
          }}
        >
          ↔
        </button>
      )}
      {blocked && (
        <span id={feedbackId} className="sr-only">
          {draft === "conflict"
            ? "This transition competes with another transition on the same cut or visible frames."
            : edit?.locked
              ? "Blocked: the track is locked."
              : `Fade duration must be between 1 and ${placementFrames} sequence frames.`}
        </span>
      )}
    </>
  );
}
