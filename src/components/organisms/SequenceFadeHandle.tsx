import { type PointerEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { Sequence } from "@/types";

type SequenceFadeHandleProps = {
  label: string;
  edge: "entry" | "reveal";
  frames: number;
  placementFrames: number;
  pixelsPerFrame: number;
  edit?: {
    evaluate: (frames: number) => Sequence | null;
    commit: (next: Sequence) => void;
  };
};

export default function SequenceFadeHandle({
  label,
  edge,
  frames,
  placementFrames,
  pixelsPerFrame,
  edit,
}: SequenceFadeHandleProps) {
  const drag = useRef<{ pointerId: number; x: number } | null>(null);
  const [draft, setDraft] = useState<number | "blocked" | null>(null);
  const feedbackId = useId();
  const blocked = draft === "blocked";
  const percent = Math.min(
    100,
    (100 * (typeof draft === "number" ? draft : frames)) / placementFrames,
  );
  const isEntry = edge === "entry";
  const styleEdge = isEntry ? "left" : "right";
  const name = `Adjust ${edge} fade: ${label}`;

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
      {percent > 0 && (
        <span
          className={`pointer-events-none absolute top-0 h-3 overflow-hidden bg-amber-300 indent-1 text-[9px]/3 font-semibold whitespace-nowrap text-amber-950 ${isEntry ? "rounded-r" : "rounded-l"}`}
          style={{ [styleEdge]: 0, width: `${percent}%` }}
        >
          {isEntry ? "Fade in" : "Fade out"}
        </span>
      )}
      {edit && (
        <button
          type="button"
          aria-label={name}
          aria-describedby={blocked ? feedbackId : undefined}
          data-state={blocked ? "blocked" : undefined}
          title={name}
          // Distinct vertical lanes keep the grips reachable even when the fade regions meet.
          className={`absolute z-10 h-2 w-3 cursor-ew-resize touch-none rounded-sm border border-amber-100 bg-amber-700 text-[8px]/[6px] font-bold text-white select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white data-[state=blocked]:bg-rose-700 ${isEntry ? "top-0 -translate-x-1/2" : "top-2 translate-x-1/2"}`}
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
            if (next !== null)
              setDraft(next === frames ? null : edit.evaluate(next) ? next : "blocked");
          }}
          onPointerUp={(event) => {
            const next = proposedFrames(event);
            if (next === null) return;
            clearDrag();
            const evaluated = edit.evaluate(next);
            if (evaluated) edit.commit(evaluated);
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
          Fade duration must be between 1 and {placementFrames} sequence frames.
        </span>
      )}
    </>
  );
}
