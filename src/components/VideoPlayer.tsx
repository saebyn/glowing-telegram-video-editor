import VideoPlayerControls from "components/VideoPlayerControls";
import VideoPlayerProgressBar from "components/VideoPlayerProgressBar";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { MediaFile } from "types";

interface VideoPlayerProps {
  media: MediaFile[];
  length: number;
  onTimeUpdate?: (time: number) => void;
}

export interface VideoPlayerRef {
  seekTo: (milliseconds: number) => void;
}

export default forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ media, length, onTimeUpdate }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [currentVideoOffset, setCurrentVideoOffset] = useState(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [speed, setSpeed] = useState(1);

    const setPlayheadTime = useCallback(
      (milliseconds: number) => {
        const mediaItemIndex = getMediaItemIndexForTime(media, milliseconds);
        const mediaItem = media[mediaItemIndex];

        setCurrentVideoIndex(mediaItemIndex);
        setCurrentVideoOffset(milliseconds - mediaItem.offset);
      },
      [media],
    );

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (milliseconds: number) => {
          setPlayheadTime(milliseconds);
        },
      }),
      [setPlayheadTime],
    );

    const syncVideoState = () => {
      if (videoRef.current === null) {
        return;
      }

      // Play the video if it is not playing and the component is playing
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play();
      }

      // Pause the video if it is playing and the component is not playing
      if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }

      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = speed;
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: These are used in the callback
    useEffect(syncVideoState, [isPlaying, isMuted, speed]);

    function handleCanPlay() {
      console.log("Can play");
    }

    /**
     * Updates the playhead time based on the video's current time
     * relative to the media item it is currently playing within
     * the overall `media` list.
     */
    function handleTimeUpdate() {
      console.log("Time update");

      if (videoRef.current === null) {
        return;
      }

      setCurrentVideoOffset(videoRef.current.currentTime * 1000);
    }

    function handleSeekTo(time: number) {
      console.log("Seek to", time);

      setPlayheadTime(time);
    }

    function handlePauseToggle() {
      setIsPlaying((playing) => !playing);
    }

    function handleMuteToggle() {
      setIsMuted((muted) => !muted);
    }

    function handleSpeedChange(newSpeed: number) {
      setSpeed(newSpeed);
    }

    const playheadTime = media[currentVideoIndex].offset + currentVideoOffset;

    return (
      <>
        <video
          ref={videoRef}
          className="w-full"
          onTimeUpdate={handleTimeUpdate}
          onCanPlay={handleCanPlay}
          onError={console.error}
          src={media[currentVideoIndex].url}
        >
          Your browser does not support the video tag.
        </video>

        <VideoPlayerControls
          playheadTime={playheadTime}
          playing={isPlaying}
          onPauseToggle={handlePauseToggle}
          muted={isMuted}
          onMuteToggle={handleMuteToggle}
          speed={speed}
          onSpeedChange={handleSpeedChange}
        >
          <VideoPlayerProgressBar
            playheadTime={playheadTime}
            seekTo={handleSeekTo}
            duration={length}
          />
        </VideoPlayerControls>
      </>
    );
  },
);

function getMediaItemIndexForTime(media: MediaFile[], playheadTime: number) {
  const mediaIndex = media.findLastIndex((m) => m.offset <= playheadTime);

  if (mediaIndex === -1) {
    console.error("No media found for time", playheadTime);
    throw new Error("No media found for time");
  }

  return mediaIndex;
}

function getMediaItemForTime(media: MediaFile[], playheadTime: number) {
  const mediaIndex = getMediaItemIndexForTime(media, playheadTime);

  return media[mediaIndex];
}

function seekVideoToPlayheadTime(
  video: HTMLVideoElement,
  media: MediaFile[],
  playheadTime: number,
) {
  const mediaItem = getMediaItemForTime(media, playheadTime);
  const targetTime = (playheadTime - mediaItem.offset) / 1000;

  if (targetTime !== video.currentTime) {
    video.currentTime = targetTime;
  }
}
