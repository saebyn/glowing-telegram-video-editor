import VideoPlayerControls from "components/atoms/VideoPlayerControls";
import VideoPlayerProgressBar from "components/atoms/VideoPlayerProgressBar";
import Hls from "hls.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate?: (time: number) => void;
  onEnd?: () => void;
}

export interface VideoPlayerRef {
  seekTo: (milliseconds: number) => void;
  togglePlay: () => void;
}

export default forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ videoUrl, onTimeUpdate, onEnd }, ref) {
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const [hls, setHls] = useState<Hls | null>(null);

    // manage the hls instance
    useEffect(() => {
      console.log("creating hls instance");
      const innerHls = new Hls();

      innerHls.loadSource(videoUrl);

      setHls(innerHls);

      innerHls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS error", event, data);
      });

      return () => {
        innerHls.destroy();
      };
    }, [videoUrl]);

    // manage the video element and its link to the hls instance
    useEffect(() => {
      if (!video || !hls) {
        return;
      }

      hls.attachMedia(video);

      return () => {
        hls?.detachMedia();
      };
    }, [video, hls]);

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

        togglePlay: () => {
          if (video) {
            if (video.paused) {
              video.play();
            } else {
              video.pause();
            }
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

    if (!Hls.isSupported()) {
      return (
        <div>
          <h1>HLS is not supported</h1>
          <p>
            HLS is not supported in this browser. Please try a different browser
            to view this content.
          </p>
        </div>
      );
    }

    return (
      <>
        {/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
        <video
          ref={setVideo}
          className="w-full"
          onTimeUpdate={timeUpdate}
          onEnded={onEnd}
          onError={console.error}
        >
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
