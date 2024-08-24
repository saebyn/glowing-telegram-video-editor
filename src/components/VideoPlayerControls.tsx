import { ReactNode, useEffect, useState } from "react";
import { format } from "utils/duration";

interface VideoPlayerControlsProps {
  video: HTMLVideoElement | null;
  children: ReactNode;
}

export default function VideoPlayerControls({
  video,
  children,
}: VideoPlayerControlsProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted, video]);

  useEffect(() => {
    if (video) {
      video.loop = isLooping;
    }
  }, [isLooping, video]);

  useEffect(() => {
    if (video) {
      video.playbackRate = speed;
    }
  }, [speed, video]);

  if (!video) {
    return null;
  }

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
    setIsMuted((muted) => !muted);
  };

  const toggleLoop = () => {
    setIsLooping((looping) => !looping);
  };

  const timestamp = format(`PT${video?.currentTime.toFixed(0) || 0}S`);

  return (
    <div className="m-4 flex items-start">
      {!isPlaying ? (
        <button
          className="rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={play}
        >
          Play
        </button>
      ) : (
        <button
          className="rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={pause}
        >
          Pause
        </button>
      )}

      <span className="ml-4 rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white">
        {timestamp}
      </span>

      {children}

      <button
        className={`ml-4 rounded px-4 py-2 ${
          isMuted ? "bg-gray-200" : "bg-gray-600 text-white"
        }`}
        onClick={toggleMute}
      >
        Mute
      </button>

      <button
        className={`
            ml-4 rounded px-4 py-2
            ${video?.loop ? "bg-gray-200" : "bg-gray-600 text-white"}
            `}
        onClick={toggleLoop}
      >
        Loop
      </button>

      <button
        className="ml-4 rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
        onClick={() => video?.requestFullscreen()}
      >
        Fullscreen
      </button>

      <select
        className="ml-4 rounded bg-gray-200 px-4 py-2 text-gray-600 dark:bg-gray-800 dark:text-white"
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
      >
        <option value="0.5" selected={speed === 0.5}>
          0.5x
        </option>
        <option value="1" selected={speed === 1}>
          1x
        </option>
        <option value="1.5" selected={speed === 1.5}>
          1.5x
        </option>
        <option value="2" selected={speed === 2}>
          2x
        </option>
        <option value="5" selected={speed === 5}>
          5x
        </option>
        <option value="10" selected={speed === 10}>
          10x
        </option>
        <option value="25" selected={speed === 25}>
          25x
        </option>
      </select>
    </div>
  );
}
