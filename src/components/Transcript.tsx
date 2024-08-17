import { TranscriptSegment } from "types";
import TimestampedEventLog from "./TimestampedEventLog";

export default function Transcript({
  transcript,
  playbackTime,
  onSeekToTime,
  followPlayback = true,
}: {
  transcript: TranscriptSegment[];
  playbackTime: number;
  onSeekToTime: (milliseconds: number) => void;
  followPlayback?: boolean;
}) {
  return (
    <TimestampedEventLog<TranscriptSegment>
      log={transcript}
      playbackTime={playbackTime}
      onSeekToTime={onSeekToTime}
      renderEvent={(segment) => {
        return <span>{segment.text}</span>;
      }}
      followPlayback={followPlayback}
    />
  );
}
