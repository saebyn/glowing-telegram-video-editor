import { LogEvent } from "types";
import TimeLink from "./atoms/TimeLink";
import { createRef } from "react";
import useScrollToNearestElementToTime from "../hooks/useScrollToNearestElementToTime";

interface TimestampedEventLogProps<T extends LogEvent> {
  log: T[];
  playheadTime: number;
  onSeekToTime: (milliseconds: number) => void;
  renderEvent: (event: T) => React.ReactNode;
  followPlayback?: boolean;
}

export default function TimestampedEventLog<T extends LogEvent>({
  log,
  playheadTime,
  onSeekToTime,
  renderEvent,
  followPlayback = true,
}: TimestampedEventLogProps<T>) {
  const ref = createRef<HTMLDivElement>();
  const nearestElementIndex = useScrollToNearestElementToTime(
    playheadTime,
    ref,
    log,
    followPlayback,
  );

  return (
    <div className="mt-4" ref={ref}>
      <ul>
        {log.map((entry, i) => (
          <li
            key={`entry-${entry.timestamp}`}
            className={`mb-2 ${
              i === nearestElementIndex ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            data-index={i}
          >
            <TimeLink milliseconds={entry.timestamp} onClick={onSeekToTime} />{" "}
            {renderEvent(entry)}
          </li>
        ))}
      </ul>
    </div>
  );
}
