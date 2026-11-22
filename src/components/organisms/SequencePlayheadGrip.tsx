import { type PointerEvent, useRef } from "react";
import { snapFrame } from "@/utils/frames";

type SequencePlayheadGripProps = {
  frame: number;
  durationFrames: number;
  rulerWidth: number;
  onSeek: (frame: number) => void;
};

export default function SequencePlayheadGrip({
  frame,
  durationFrames,
  rulerWidth,
  onSeek,
}: SequencePlayheadGripProps) {
  const drag = useRef<{ pointerId: number; x: number; frame: number } | null>(null);

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (origin?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const offset = ((event.clientX - origin.x) / rulerWidth) * durationFrames;
    onSeek(snapFrame(origin.frame + offset, durationFrames));
  }

  return (
    <div
      // A native range would overlay the entire ruler rather than only the draggable grip.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="slider"
      tabIndex={0}
      aria-label="Sequence playhead"
      aria-valuemin={0}
      aria-valuemax={durationFrames}
      aria-valuenow={frame}
      className="absolute top-0 z-20 h-4 w-4 -translate-x-1/2 cursor-ew-resize touch-none rounded-b-md bg-sky-400 select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
      style={{ left: `clamp(8px, ${(frame / durationFrames) * 100}%, calc(100% - 8px))` }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.stopPropagation();
        drag.current = { pointerId: event.pointerId, x: event.clientX, frame };
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(frame);
      }}
      onPointerMove={seekFromPointer}
      onPointerUp={seekFromPointer}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const positions: Record<string, number> = {
          ArrowLeft: frame - 1,
          ArrowDown: frame - 1,
          ArrowRight: frame + 1,
          ArrowUp: frame + 1,
          Home: 0,
          End: durationFrames,
        };
        const next = positions[event.key];
        if (typeof next !== "number") return;
        event.preventDefault();
        onSeek(snapFrame(next, durationFrames));
      }}
    />
  );
}
