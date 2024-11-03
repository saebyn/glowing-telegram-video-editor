import { useState } from "react";
import { format } from "utils/duration";

interface ProgressBarProps {
  playheadTime: number;
  seekTo: (milliseconds: number) => void;
  duration: number;
}

export default function VideoPlayerProgressBar({
  playheadTime,
  seekTo,
  duration,
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

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
    const progress = x / width;
    seekTo(progress * duration);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = x / width;
    if (isDragging) {
      seekTo(progress * duration);
    } else {
      // show hover effect
      // check if the mouse is inside the progress bar
      if (x < 0 || x > width) {
        return;
      }

      setHoverTime(progress * duration);
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  const playbackPercentage = (playheadTime / duration) * 100;

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
        style={{ left: `calc(${playbackPercentage}% - 8px)` }}
      />
      {/* Hover */}
      {hoverTime !== null && !isDragging && (
        <div
          className="absolute top-0 h-full w-4 cursor-pointer rounded-full bg-gray-400 dark:bg-gray-600"
          style={{ left: `calc(${(hoverTime / duration) * 100}% - 8px)` }}
        >
          <div className="absolute top-0 -mt-8 rounded bg-black/50 px-2 py-1 text-xs text-white">
            {format(`PT${(hoverTime / 1000).toFixed(0)}S`)}
          </div>
        </div>
      )}
    </div>
  );
}
