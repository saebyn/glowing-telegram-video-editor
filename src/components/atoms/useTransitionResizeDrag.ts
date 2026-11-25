import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type TransitionResizeGesture = {
  evaluate: (frames: number) => "valid" | "blocked" | "conflict";
  commit: (frames: number) => void;
};

export function useTransitionResizeDrag(
  edit: TransitionResizeGesture | undefined,
  frames: number,
  framesPerPixel: number,
  anchor: number,
  extent?: number,
) {
  const drag = useRef<{ pointerId: number; x: number } | null>(null);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState<number | "blocked" | "conflict" | null>(null);
  const feedbackId = useId();
  const enabled = !!edit;

  function clearDrag() {
    drag.current = null;
    setActive(false);
    setDraft(null);
  }

  // A drag measures its displacement from the authored duration and scale.
  useLayoutEffect(() => {
    if (drag.current) clearDrag();
  }, [enabled, frames, framesPerPixel, anchor, extent]);

  useEffect(() => {
    if (!active) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearDrag();
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [active]);

  function proposedFrames(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (origin?.pointerId !== event.pointerId) return null;
    event.stopPropagation();
    return frames + Math.round((event.clientX - origin.x) * framesPerPixel);
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (drag.current?.pointerId === event.pointerId) clearDrag();
  }

  const blocked = draft === "blocked" || draft === "conflict" ? draft : null;
  return {
    active,
    previewFrames: typeof draft === "number" ? draft : null,
    blocked,
    feedbackId,
    gripProps: {
      "aria-describedby": blocked ? feedbackId : undefined,
      "data-state": blocked ? "blocked" : undefined,
      onClick: (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation(),
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
        if (!edit || !event.isPrimary || event.button !== 0) return;
        drag.current = { pointerId: event.pointerId, x: event.clientX };
        setActive(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const next = proposedFrames(event);
        if (next === null || !edit) return;
        if (next === frames) {
          setDraft(null);
          return;
        }
        const evaluated = edit.evaluate(next);
        setDraft(evaluated === "valid" ? next : evaluated);
      },
      onPointerUp(event: PointerEvent<HTMLButtonElement>) {
        const next = proposedFrames(event);
        if (next === null) return;
        clearDrag();
        edit?.commit(next);
      },
      onPointerCancel: cancelDrag,
      onLostPointerCapture: cancelDrag,
    },
  };
}

export const transitionResizeConflict =
  "This transition competes with another transition on the same cut or visible frames.";
