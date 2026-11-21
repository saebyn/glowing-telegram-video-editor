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
  const [isDragging, setIsDragging] = useState(false);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const progress = durationFrames > 0 ? (playheadFrame / durationFrames) * 100 : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);

    // seek to the current position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    if (width > 0 && durationFrames > 0) {
      onSeek(snapFrame((x / width) * durationFrames, durationFrames));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    if (width <= 0 || durationFrames <= 0) return;
    const frame = snapFrame((x / width) * durationFrames, durationFrames);
    if (isDragging) {
      onSeek(frame);
    } else {
      // show hover effect
      // check if the mouse is inside the progress bar
      if (x < 0 || x > width) {
        return;
      }

      setHoverFrame(frame);
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverFrame(null);
  };

  return (
    <div
      className="relative ml-4 mt-3 h-4 flex-1 cursor-pointer rounded-full bg-gray-800 dark:bg-gray-200"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Progress */}
      <div
        className="absolute top-0 h-full w-4 cursor-pointer rounded-full bg-gray-200 dark:bg-gray-800"
        style={{ left: `calc(${progress}% - 8px)` }}
      />
      {/* Hover */}
      {hoverFrame !== null && durationFrames > 0 && !isDragging && (
        <div
          className="absolute top-0 h-full w-4 cursor-pointer rounded-full bg-gray-400 dark:bg-gray-600"
          style={{ left: `calc(${(hoverFrame / durationFrames) * 100}% - 8px)` }}
        >
          <div className="absolute top-0 -mt-8 rounded-sm bg-black/50 px-2 py-1 text-xs text-white">
            {formatFrames(hoverFrame, frameRate)}
          </div>
        </div>
      )}
    </div>
  );
}
