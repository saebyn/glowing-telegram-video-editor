import { getDissolveWindow } from "@/utils/dissolveWindow";
import {
  type TransitionResizeGesture,
  transitionResizeConflict,
  useTransitionResizeDrag,
} from "./useTransitionResizeDrag";

type SequenceDissolveHandleProps = {
  label: string;
  frames: number;
  cut: number;
  sequenceDuration: number;
  pixelsPerFrame: number;
  scrollLeft: number;
  viewportWidth: number;
  top: number;
  height: number;
  selected: boolean;
  extensions: readonly string[];
  onSelect?: () => void;
  edit?: TransitionResizeGesture;
};

export default function SequenceDissolveHandle({
  label,
  frames,
  cut,
  sequenceDuration,
  pixelsPerFrame,
  scrollLeft,
  viewportWidth,
  top,
  height,
  selected,
  extensions,
  onSelect,
  edit,
}: SequenceDissolveHandleProps) {
  const authoredWindow = getDissolveWindow(cut, frames, sequenceDuration);
  // A centered resize grows both sides. Use the left edge when the right
  // edge is already at the sequence boundary so the handle can move inward.
  const resizeFromLeft = authoredWindow.endFrame === sequenceDuration;
  const { active, previewFrames, blocked, feedbackId, gripProps } = useTransitionResizeDrag(
    edit,
    frames,
    (resizeFromLeft ? -2 : 2) / pixelsPerFrame,
    cut,
    sequenceDuration,
  );
  const { startFrame, endFrame } =
    previewFrames === null
      ? authoredWindow
      : getDissolveWindow(cut, previewFrames, sequenceDuration);
  const left = startFrame * pixelsPerFrame - scrollLeft;
  const right = endFrame * pixelsPerFrame - scrollLeft;
  const gripX = resizeFromLeft ? left : right;
  const name = `Adjust dissolve: ${label}`;

  return (
    <>
      {right > left && right > 0 && left < viewportWidth && (
        <button
          type="button"
          aria-label={`Select dissolve: ${label}`}
          aria-pressed={selected}
          title={[
            `Dissolve: sequence frames [${startFrame}, ${endFrame})`,
            ...(previewFrames === null ? extensions : []),
          ].join("\n")}
          disabled={!onSelect}
          className={`absolute overflow-hidden rounded-sm bg-violet-200/85 text-[9px] text-violet-950 inset-ring inset-ring-violet-900 aria-pressed:bg-violet-500/95 aria-pressed:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${selected ? "z-[2]" : "z-[1]"} ${onSelect ? "pointer-events-auto cursor-pointer" : ""}`}
          style={{ left, top, width: right - left, height }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          Dissolve
        </button>
      )}
      {edit && frames > 0 && (active || (gripX >= 0 && gripX <= viewportWidth)) && (
        <button
          type="button"
          aria-label={name}
          title={previewFrames === null ? name : `${previewFrames} sequence frames`}
          className={`pointer-events-auto absolute h-2 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm bg-violet-700 text-[8px]/[6px] font-bold text-white inset-ring inset-ring-violet-100 select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white data-[state=blocked]:bg-rose-700 ${selected ? "z-[4]" : "z-[3]"}`}
          style={{ left: Math.max(6, Math.min(viewportWidth - 6, gripX)), top }}
          {...gripProps}
        >
          ↔
        </button>
      )}
      {blocked && (
        <span id={feedbackId} className="sr-only">
          {blocked === "conflict"
            ? transitionResizeConflict
            : "Dissolve duration must be a positive whole number of sequence frames."}
        </span>
      )}
    </>
  );
}
