import { TransportBar } from "@keplar-404/react-timeline-editor";
import type { PropsWithChildren, ReactNode } from "react";
import { formatTimecode, framesToSeconds, secondsToFrame } from "@/utils/frames";
import RenameSequenceTrack, { type RenameSequenceTrackProps } from "./RenameSequenceTrack";
import { AddSequenceTrack } from "./SequenceTrackActions";
import ShortenSequenceForm, { type ShortenSequenceFormProps } from "./ShortenSequenceForm";
import type { SequencePreviewPlaceholderProps } from "./SequencePreviewPlaceholder";

export interface SequenceTransportControlsProps extends SequencePreviewPlaceholderProps {
  seek: (sequenceFrame: number) => void;
  playForward: () => void;
  playReverse: () => void;
  pause: () => void;
}

export function SequenceTransportControls({
  playheadFrame,
  frameRate,
  playback,
  seek,
  playForward,
  playReverse,
  pause,
}: SequenceTransportControlsProps) {
  const jumpFrames = secondsToFrame(1, frameRate);
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
            rewind: () => seek(playheadFrame - jumpFrames),
            forward: () => seek(playheadFrame + jumpFrames),
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

export interface SequenceToolbarProps {
  transport: SequenceTransportControlsProps;
  splitAtPlayhead?: () => void;
  splitMode: boolean;
  toggleSplitMode?: () => void;
  undo?: () => void;
  redo?: () => void;
  deleteSelection?: () => void;
  shorten?: ShortenSequenceFormProps;
  addTrack?: () => void;
  renameTrack?: RenameSequenceTrackProps;
  /** Layout action controls supplied by the default page or a host layout. */
  paneToggles?: ReactNode;
}

export default function SequenceToolbar({
  transport,
  splitAtPlayhead,
  splitMode,
  toggleSplitMode,
  undo,
  redo,
  deleteSelection,
  shorten,
  addTrack,
  renameTrack,
  paneToggles,
}: SequenceToolbarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="mr-3 text-xl font-semibold">Sequence editor</h1>
      <SequenceTransportControls {...transport} />
      <SequenceEditButton onClick={splitAtPlayhead}>Split</SequenceEditButton>
      {toggleSplitMode && (
        <button
          type="button"
          aria-pressed={splitMode}
          className="rounded border px-3 py-1 text-sm aria-pressed:bg-amber-200 aria-pressed:text-amber-950"
          onClick={toggleSplitMode}
        >
          Split mode
        </button>
      )}
      <SequenceEditButton onClick={undo}>Undo</SequenceEditButton>
      <SequenceEditButton onClick={redo}>Redo</SequenceEditButton>
      <SequenceEditButton onClick={deleteSelection}>Delete</SequenceEditButton>
      {shorten && <ShortenSequenceForm {...shorten} />}
      {addTrack && <AddSequenceTrack onAddTrack={addTrack} />}
      {renameTrack && <RenameSequenceTrack {...renameTrack} />}
      {paneToggles}
    </header>
  );
}

export interface SequenceEditButtonProps {
  onClick?: () => void;
}

export function SequenceEditButton({
  onClick,
  children,
}: PropsWithChildren<SequenceEditButtonProps>) {
  return (
    <button
      type="button"
      // Preserve focus when an accepted Undo or Redo makes its action unavailable.
      aria-disabled={!onClick}
      tabIndex={onClick ? undefined : -1}
      className="rounded border px-3 py-1 text-sm aria-disabled:opacity-60"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
