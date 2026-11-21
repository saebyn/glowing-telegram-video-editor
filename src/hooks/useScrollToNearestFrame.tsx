import { useEffect } from "react";
import type { LogEvent } from "@/types";

/**
 * A hook that finds the nearest element to the given frame in the log
 * and scrolls the element into view.
 *
 */

export default function useScrollToNearestFrame<T extends LogEvent>(
  frame: number,
  ref: React.RefObject<HTMLDivElement | null>,
  log: T[],
  followPlayback: boolean,
): number | null {
  const nearestElementIndex = findNearestFrame(frame, log);

  useEffect(() => {
    if (!followPlayback) {
      return;
    }

    const nearestElement = ref.current?.querySelector(`[data-index="${nearestElementIndex}"]`);

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
 * Find the nearest element to the given frame in the log and
 * return the element index or null if the log is empty.
 */
function findNearestFrame<T extends LogEvent>(frame: number, log: T[]): number | null {
  let nearestElementIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < log.length; index++) {
    const item = log[index];
    const distance = Math.abs(item.sourceFrame - frame);
    if (distance < nearestDistance) {
      nearestElementIndex = index;
      nearestDistance = distance;
    }

    // The history is sorted by frame, so we can break early
    // if the distance is increasing.
    else if (distance > nearestDistance) {
      break;
    }
  }

  return nearestElementIndex;
}
