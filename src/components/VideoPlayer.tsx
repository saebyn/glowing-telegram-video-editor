import { forwardRef, useImperativeHandle, useRef } from "react";
import VideoPlayerProgressBar from "./VideoPlayerProgressBar";
import VideoPlayerControls from "./VideoPlayerControls";

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

        <VideoPlayerControls video={videoRef.current}>
          <VideoPlayerProgressBar
            progress={progress}
            seekToPercent={seekToPercent}
            duration={videoRef.current?.duration || 0}
          />
        </VideoPlayerControls>
      </>
    );
  },
);
