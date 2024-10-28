import { forwardRef, useImperativeHandle, useState } from "react";
import VideoPlayerProgressBar from "components/VideoPlayerProgressBar";
import VideoPlayerControls from "components/VideoPlayerControls";

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
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);

    const timeUpdate = () => {
      if (video) {
        onTimeUpdate?.(video.currentTime * 1000);
      }
    };

    const progress = ((video?.currentTime || 0) / (video?.duration || 1)) * 100;

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (milliseconds: number) => {
          if (video) {
            video.currentTime = milliseconds / 1000;
          }
        },
      }),
      [video],
    );

    const seekToPercent = (progress: number) => {
      if (video) {
        video.currentTime = (progress / 100) * video.duration;
      }
    };

    return (
      <>
        <video
          ref={setVideo}
          className="w-full"
          onTimeUpdate={timeUpdate}
          onEnded={onEnd}
          onError={console.error}
        >
          <source type="video/mp4" src={videoUrl} />
          Your browser does not support the video tag.
        </video>

        <VideoPlayerControls video={video}>
          <VideoPlayerProgressBar
            progress={progress}
            seekToPercent={seekToPercent}
            duration={video?.duration || 0}
          />
        </VideoPlayerControls>
      </>
    );
  },
);
