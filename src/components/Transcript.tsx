import { TranscriptSegment } from "types";
import TimestampedEventLog from "./TimestampedEventLog";

export default function Transcript({
  transcript,
  playheadTime,
  onSeekToTime,
  followPlayback = true,
}: {
  transcript: TranscriptSegment[];
  playheadTime: number;
  onSeekToTime: (milliseconds: number) => void;
  followPlayback?: boolean;
}) {
  return (
    <TimestampedEventLog<TranscriptSegment>
      log={transcript}
      playheadTime={playheadTime}
      onSeekToTime={onSeekToTime}
      renderEvent={(segment) => {
        return <span>{segment.text}</span>;
      }}
      followPlayback={followPlayback}
    />
  );
}
