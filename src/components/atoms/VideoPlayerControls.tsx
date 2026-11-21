import { type ReactNode, useEffect, useState } from "react";
import { format } from "@/utils/duration";

export type PlaybackOptions = {
  muted: boolean;
  loop: boolean;
  speed: number;
};

interface VideoPlayerControlsProps {
  video: HTMLVideoElement | null;
  playbackOptions: PlaybackOptions;
  onPlaybackOptionsChange: (options: PlaybackOptions) => void;
  children: ReactNode;
}

export default function VideoPlayerControls({
  video,
  playbackOptions,
  onPlaybackOptionsChange,
  children,
}: VideoPlayerControlsProps) {
  const { muted, loop, speed } = playbackOptions;
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // handle events from the video element that change the state
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video?.addEventListener("play", handlePlay);
    video?.addEventListener("pause", handlePause);
  }, [video]);

  const play = () => {
    if (video) {
      video.play().then(() => {
        setIsPlaying(true);
      });
    }
  };

  const pause = () => {
    if (video) {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    onPlaybackOptionsChange({ ...playbackOptions, muted: !muted });
  };

  const toggleLoop = () => {
    onPlaybackOptionsChange({ ...playbackOptions, loop: !loop });
  };

  const timestamp = format(`PT${video?.currentTime.toFixed(0) || 0}S`);

  return (
    <div className="m-4 flex items-start">
      {!isPlaying ? (
        <button
          type="button"
          className="rounded-sm bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={play}
        >
          Play
        </button>
      ) : (
        <button
          type="button"
          className="rounded-sm bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={pause}
        >
          Pause
        </button>
      )}

      <span className="ml-4 rounded-sm bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white">
        {timestamp}
      </span>

      {children}

      <button
        type="button"
        className={`ml-4 rounded-sm px-4 py-2 ${muted ? "bg-gray-200" : "bg-gray-600 text-white"}`}
        onClick={toggleMute}
      >
        Mute
      </button>

      <button
        type="button"
        className={`
            ml-4 rounded-sm px-4 py-2
            ${loop ? "bg-gray-200" : "bg-gray-600 text-white"}
            `}
        onClick={toggleLoop}
      >
        Loop
      </button>

      <button
        type="button"
        className="ml-4 rounded-sm bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
        onClick={() => video?.requestFullscreen()}
      >
        Fullscreen
      </button>

      <select
        className="ml-4 rounded-sm bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
        value={speed}
        onChange={(e) =>
          onPlaybackOptionsChange({ ...playbackOptions, speed: Number.parseFloat(e.target.value) })
        }
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
