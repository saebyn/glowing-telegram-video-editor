import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { format } from "utils/duration";
import VideoPlayerProgressBar from "./VideoPlayerProgressBar";

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate?: (time: number) => void;
  onEnd?: () => void;
}

export interface VideoPlayerRef {
  seekTo: (milliseconds: number) => void;
}

export default forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ videoUrl, onTimeUpdate, onEnd }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
      }
    }, [isMuted]);

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.loop = isLooping;
      }
    }, [isLooping]);

    const timeUpdate = () => {
      if (videoRef.current) {
        onTimeUpdate?.(videoRef.current.currentTime * 1000);
      }
    };

    const progress =
      ((videoRef.current?.currentTime || 0) /
        (videoRef.current?.duration || 1)) *
      100;

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (milliseconds: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = milliseconds / 1000;
          }
        },
      }),
      [],
    );

    const seekToPercent = (progress: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime =
          (progress / 100) * videoRef.current.duration;
      }
    };

    const play = () => {
      if (videoRef.current) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        });
      }
    };

    const pause = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const toggleMute = () => {
      setIsMuted((muted) => !muted);
    };

    const toggleLoop = () => {
      setIsLooping((looping) => !looping);
    };

    const timestamp = format(
      `PT${videoRef.current?.currentTime.toFixed(0) || 0}S`,
    );

    return (
      <>
        <video
          ref={videoRef}
          className="w-full"
          onTimeUpdate={timeUpdate}
          onEnded={onEnd}
          onError={console.error}
        >
          <source type="video/mp4" src={videoUrl} />
          Your browser does not support the video tag.
        </video>

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

          <VideoPlayerProgressBar
            progress={progress}
            seekToPercent={seekToPercent}
            duration={videoRef.current?.duration || 0}
          />

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
            ${videoRef.current?.loop ? "bg-gray-200" : "bg-gray-600 text-white"}
            `}
            onClick={toggleLoop}
          >
            Loop
          </button>
        </div>
      </>
    );
  },
);
