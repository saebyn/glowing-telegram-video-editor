import { useState } from "react";
import type { FrameRate } from "@/types";
import { formatFrames, snapFrame } from "@/utils/frames";

interface ProgressBarProps {
  playheadFrame: number;
  onSeek: (frame: number) => void;
  durationFrames: number;
  frameRate: FrameRate;
}

export default function VideoPlayerProgressBar({
  playheadFrame,
  onSeek,
  durationFrames,
  frameRate,
}: ProgressBarProps) {
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const visibleFrame = snapFrame(playheadFrame, durationFrames);
  const progress = durationFrames > 0 ? (visibleFrame / durationFrames) * 100 : 0;

  const handleMouseMove = (event: React.MouseEvent<HTMLInputElement>) => {
    if (event.buttons !== 0) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (width > 0)
      setHoverFrame(snapFrame(((event.clientX - left) / width) * durationFrames, durationFrames));
  };

  return (
    <div className="relative ml-4 mt-3 h-4 flex-1 rounded-full bg-gray-800 dark:bg-gray-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500">
      {/* Progress */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-full w-4 rounded-full bg-gray-200 dark:bg-gray-800"
        style={{ left: `calc(${progress}% - 8px)` }}
      />
      {/* Hover */}
      {hoverFrame !== null && durationFrames > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-full w-4 rounded-full bg-gray-400 dark:bg-gray-600"
          style={{ left: `calc(${(hoverFrame / durationFrames) * 100}% - 8px)` }}
        >
          <div className="absolute top-0 -mt-8 rounded-sm bg-black/50 px-2 py-1 text-xs text-white">
            {formatFrames(hoverFrame, frameRate)}
          </div>
        </div>
      )}
      <input
        type="range"
        dir="ltr"
        min={0}
        max={durationFrames}
        step={1}
        value={visibleFrame}
        disabled={durationFrames <= 0}
        aria-label="Video playback position"
        aria-valuetext={formatFrames(visibleFrame, frameRate)}
        className="gtve-seek-input absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
        onPointerDown={() => setHoverFrame(null)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverFrame(null)}
      />
    </div>
  );
}
