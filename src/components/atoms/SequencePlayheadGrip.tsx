import type { Ref } from "react";
import { snapFrame } from "@/utils/frames";

export type SequencePlayheadGripProps = {
  ref?: Ref<HTMLDivElement>;
  frame: number;
  durationFrames: number;
  pixelsPerFrame: number;
  scrollLeft: number;
  viewportWidth: number;
  onSeek: (frame: number) => void;
};

export default function SequencePlayheadGrip({
  ref,
  frame,
  durationFrames,
  pixelsPerFrame,
  scrollLeft,
  viewportWidth,
  onSeek,
}: SequencePlayheadGripProps) {
  const x = frame * pixelsPerFrame - scrollLeft;

  return (
    <div
      ref={ref}
      // The timeline handles pointer gestures; this coincident target handles keyboard seeking.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="slider"
      tabIndex={0}
      aria-label="Sequence playhead"
      aria-valuemin={0}
      aria-valuemax={Math.max(durationFrames, frame)}
      aria-valuenow={frame}
      className="pointer-events-none absolute top-0 z-20 h-4 w-4 -translate-x-1/2 rounded-b-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
      style={{
        left: Math.max(8, Math.min(viewportWidth - 8, x)),
        visibility: x < 0 || x > viewportWidth ? "hidden" : undefined,
      }}
      onKeyDown={(event) => {
        const inRangeFrame = snapFrame(frame, durationFrames);
        const positions: Record<string, number> = {
          ArrowLeft: inRangeFrame - 1,
          ArrowDown: inRangeFrame - 1,
          ArrowRight: inRangeFrame + 1,
          ArrowUp: inRangeFrame + 1,
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
