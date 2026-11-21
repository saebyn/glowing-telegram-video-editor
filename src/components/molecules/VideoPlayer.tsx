import Hls from "hls.js";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import VideoPlayerControls from "@/components/atoms/VideoPlayerControls";
import VideoPlayerProgressBar from "@/components/atoms/VideoPlayerProgressBar";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { FrameRate } from "@/types";
import { framesToSeconds, secondsToFrame, snapFrame } from "@/utils/frames";

export interface VideoPlayerProps {
  videoUrl: string;
  /** Omit for a sequence preview, which uses the project frame rate. */
  sourceFrameRate?: FrameRate;
  durationFrames: number;
  onFrameUpdate?: (frame: number) => void;
  onEnd?: () => void;
}

export interface VideoPlayerRef {
  seekTo: (frame: number) => void;
  togglePlay: () => void;
}

export default forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer(
  { videoUrl, sourceFrameRate, durationFrames, onFrameUpdate, onEnd },
  ref,
) {
  const frameRate = useProjectFrameRate(sourceFrameRate);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [hls, setHls] = useState<Hls | null>(null);
  const [mediaSeconds, setMediaSeconds] = useState(0);
  const lastReportedFrame = useRef<number | null>(null);

  // manage the hls instance
  useEffect(() => {
    if (!Hls.isSupported()) return;
    const innerHls = new Hls();

    innerHls.loadSource(videoUrl);

    setHls(innerHls);

    innerHls.on(Hls.Events.ERROR, (event, data) => {
      console.error(
        `HLS error: Type - ${data.type}, Details - ${data.details}, Fatal - ${data.fatal}`,
        event,
        data,
      );
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

  const currentFrame = snapFrame(secondsToFrame(mediaSeconds, frameRate), durationFrames);
  const reportFrame = useCallback(
    (frame: number) => {
      lastReportedFrame.current = frame;
      onFrameUpdate?.(frame);
    },
    [onFrameUpdate],
  );

  // A new grid can change the frame even when the media clock is paused.
  useLayoutEffect(() => {
    if (lastReportedFrame.current !== null && lastReportedFrame.current !== currentFrame) {
      reportFrame(currentFrame);
    }
  }, [currentFrame, reportFrame]);

  const updatePlayhead = useCallback(
    (seconds: number) => {
      setMediaSeconds(seconds);
      reportFrame(snapFrame(secondsToFrame(seconds, frameRate), durationFrames));
    },
    [frameRate, durationFrames, reportFrame],
  );

  const seekToFrame = useCallback(
    (frame: number) => {
      if (video) {
        const seconds = framesToSeconds(snapFrame(frame, durationFrames), frameRate);
        const target = Number.isFinite(video.duration)
          ? Math.min(seconds, video.duration)
          : seconds;
        video.currentTime = target;
        // Use the snapped target immediately. Browser playback reports its position later.
        updatePlayhead(target);
      }
    },
    [video, frameRate, durationFrames, updatePlayhead],
  );

  useImperativeHandle(
    ref,
    () => ({
      seekTo: seekToFrame,

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
    [video, seekToFrame],
  );

  if (!Hls.isSupported()) {
    return (
      <div>
        <h1>HLS is not supported</h1>
        <p>
          HLS is not supported in this browser. Please try a different browser to view this content.
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
        onTimeUpdate={(event) => updatePlayhead(event.currentTarget.currentTime)}
        onEnded={onEnd}
        onError={console.error}
      >
        Your browser does not support the video tag.
      </video>

      <VideoPlayerControls video={video}>
        <VideoPlayerProgressBar
          playheadFrame={currentFrame}
          onSeek={seekToFrame}
          durationFrames={durationFrames}
          frameRate={frameRate}
        />
      </VideoPlayerControls>
    </>
  );
});
