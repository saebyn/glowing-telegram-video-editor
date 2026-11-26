import { TransportBar } from "@keplar-404/react-timeline-editor";
import type { SequenceTransportSnapshot } from "@/types";
import { formatTimecode, framesToSeconds, secondsToFrame, snapFrame } from "@/utils/frames";

export interface SequenceTransportControlsProps extends SequenceTransportSnapshot {
  seek: (sequenceFrame: number) => void;
  playForward: () => void;
  playReverse: () => void;
  pause: () => void;
}

export function SequenceTransportControls({
  playheadFrame,
  durationFrames,
  frameRate,
  playback,
  seek,
  playForward,
  playReverse,
  pause,
}: SequenceTransportControlsProps) {
  const jumpFrames = secondsToFrame(1, frameRate);
  const inRangeFrame = snapFrame(playheadFrame, durationFrames);
  const reversing = playback === "reverse";
  return (
    <fieldset className="gtve-sequence-transport">
      <legend className="sr-only">Sequence transport</legend>
      <button
        type="button"
        disabled={playheadFrame === 0}
        className="timeline-transport-btn timeline-transport-btn--primary gtve-play-reverse"
        aria-label="Play reverse"
        aria-pressed={reversing}
        title={reversing ? "Pause reverse" : "Play reverse"}
        onClick={reversing ? pause : playReverse}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M12 1.5 1 7l11 5.5z" />
        </svg>
      </button>
      <div
        className="min-w-0 max-w-full"
        onClickCapture={(event) => {
          // Keplar's buttons omit type="button"; never submit a surrounding host form.
          if ((event.target as Element).closest("button")) event.preventDefault();
        }}
      >
        <TransportBar
          playRates={[]}
          formatDisplayTime={() =>
            `${formatTimecode(playheadFrame, frameRate)}\n${playheadFrame} fr`
          }
          player={{
            isPlaying: playback !== "paused",
            currentTime: framesToSeconds(playheadFrame, frameRate),
            playRate: 1,
            play: playForward,
            pause,
            stop: () => seek(0),
            toStart: () => seek(0),
            rewind: () => seek(inRangeFrame - jumpFrames),
            forward: () => seek(inRangeFrame + jumpFrames),
            setTime: (seconds) => seek(secondsToFrame(seconds, frameRate)),
            setPlayRate: () => {},
          }}
        />
      </div>
      <output aria-label="Sequence playhead position" aria-live="off" className="sr-only">
        Sequence frame {playheadFrame}
      </output>
    </fieldset>
  );
}
