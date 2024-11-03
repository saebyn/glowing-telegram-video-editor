import { type ReactNode, useEffect, useState } from "react";
import { format } from "utils/duration";

interface VideoPlayerControlsProps {
  playheadTime: number;

  playing: boolean;
  onPauseToggle: () => void;
  muted: boolean;
  onMuteToggle: () => void;
  speed: number;
  onSpeedChange: (newSpeed: number) => void;

  children: ReactNode;
}

export default function VideoPlayerControls({
  playheadTime,

  playing,
  onPauseToggle,
  muted,
  onMuteToggle,
  speed,
  onSpeedChange,

  children,
}: VideoPlayerControlsProps) {
  const playSeconds = playheadTime / 1000;
  const timestamp = format(`PT${playSeconds.toFixed(0) || 0}S`);

  return (
    <div className="m-4 flex items-start">
      {!playing ? (
        <button
          type="button"
          className="rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={onPauseToggle}
        >
          Play
        </button>
      ) : (
        <button
          type="button"
          className="rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={onPauseToggle}
        >
          Pause
        </button>
      )}

      <span className="ml-4 rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white">
        {timestamp}
      </span>

      {children}

      <button
        type="button"
        className={`ml-4 rounded px-4 py-2 ${
          muted ? "bg-gray-200" : "bg-gray-600 text-white"
        }`}
        onClick={onMuteToggle}
      >
        Mute
      </button>

      <select
        className="ml-4 rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
        defaultValue={speed}
        onChange={(e) => onSpeedChange(Number.parseFloat(e.target.value))}
      >
        <option value="0.5">0.5x</option>
        <option value="1">1x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
        <option value="5">5x</option>
        <option value="10">10x</option>
        <option value="25">25x</option>
      </select>
    </div>
  );
}
