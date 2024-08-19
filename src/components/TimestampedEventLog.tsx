import { LogEvent } from "types";
import TimeLink from "./TimeLink";
import { createRef, useEffect } from "react";

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

/**
 * A hook that finds the nearest element to the given time in the log
 * and scrolls the element into view.
 *
 */
export function useScrollToNearestElementToTime<T extends LogEvent>(
  time: number,
  ref: React.RefObject<HTMLDivElement>,
  log: T[],
  followPlayback: boolean,
): number | null {
  const nearestElementIndex = findNearestElementToTime(time, log);

  useEffect(() => {
    if (!followPlayback) {
      return;
    }

    const nearestElement = ref.current?.querySelector(
      `[data-index="${nearestElementIndex}"]`,
    );

    if (nearestElement) {
      nearestElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [ref, nearestElementIndex, followPlayback]);

  return nearestElementIndex;
}

/**
 * Find the nearest element to the given time in the log and
 * return the element index or null if the log is empty.
 */
export function findNearestElementToTime<T extends LogEvent>(
  time: number,
  log: T[],
): number | null {
  let nearestElementIndex: number | null = null;
  let nearestDistance = Infinity;

  for (let index = 0; index < log.length; index++) {
    const item = log[index];
    const distance = Math.abs(item.timestamp - time);
    if (distance < nearestDistance) {
      nearestElementIndex = index;
      nearestDistance = distance;
    }

    // Th history is sorted by timestamp, so we can break early
    // if the distance is increasing.
    else if (distance > nearestDistance) {
      break;
    }
  }

  return nearestElementIndex;
}
