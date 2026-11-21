import { createRef } from "react";
import type { FrameRate, LogEvent } from "@/types";
import useScrollToNearestFrame from "@/hooks/useScrollToNearestFrame";
import TimeLink from "../atoms/TimeLink";

interface TimestampedEventLogProps<T extends LogEvent> {
  log: T[];
  playheadFrame: number;
  frameRate: FrameRate;
  onSeekToFrame: (sourceFrame: number) => void;
  renderEvent: (event: T) => React.ReactNode;
  followPlayback?: boolean;
}

export default function TimestampedEventLog<T extends LogEvent>({
  log,
  playheadFrame,
  frameRate,
  onSeekToFrame,
  renderEvent,
  followPlayback = true,
}: TimestampedEventLogProps<T>) {
  const logRef = createRef<HTMLDivElement>();
  const nearestElementIndex = useScrollToNearestFrame(playheadFrame, logRef, log, followPlayback);

  return (
    <div className="mt-4" ref={logRef}>
      <ul>
        {log.map((entry, i) => (
          <li
            key={`entry-${entry.sourceFrame}-${i}`}
            className={`mb-2 ${i === nearestElementIndex ? "bg-gray-200 dark:bg-gray-700" : ""}`}
            data-index={i}
          >
            <TimeLink frame={entry.sourceFrame} frameRate={frameRate} onClick={onSeekToFrame} />{" "}
            {renderEvent(entry)}
          </li>
        ))}
      </ul>
    </div>
  );
}
