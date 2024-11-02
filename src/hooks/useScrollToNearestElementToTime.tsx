import { useEffect } from "react";
import type { LogEvent } from "types";

/**
 * A hook that finds the nearest element to the given time in the log
 * and scrolls the element into view.
 *
 */

export default function useScrollToNearestElementToTime<T extends LogEvent>(
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
function findNearestElementToTime<T extends LogEvent>(
  time: number,
  log: T[],
): number | null {
  let nearestElementIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

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
