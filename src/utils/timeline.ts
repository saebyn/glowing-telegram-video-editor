/**
 * Timeline utilities
 *
 * This module provides utilities for managing the visualization of a timeline
 * The timeline is modeled as a data structure with the following properties:
 * - Each element on the timeline has a type, a start time, and an optional
 *    end time.
 * - The times are represented in milliseconds as integers.
 * - A lens is used to define the visible portion of the timeline and translate
 *    time values to relative values.
 * - The timeline is represented as a list of elements and a total length.
 * - There are functions to convert a relative value to a time value and
 *    vice versa using the lens.
 * - There are also functions to find the elements that are visible in the
 *    viewport based on the lens.
 * - There are functions to apply a zoom in or out effect to the lens.
 * - There are functions to pan the lens to the left or right.
 */

/**
 * A timeline element
 */
export interface TimelineItem<ElementType> {
  type: ElementType;
  startMilliseconds: number;
  endMilliseconds?: number;
  text: string;
}

/**
 * A lens to focus on a portion of the timeline
 */
export interface TimelineLens {
  startMilliseconds: number;
  endMilliseconds: number;

  timelineDurationMilliseconds: number;
}

/**
 * A timeline
 */
export interface Timeline<ElementType> {
  sortedElements: TimelineItem<ElementType>[];
  timelineDurationMilliseconds: number;
}

/**
 * Create a new timeline
 */
export function createTimeline<ElementType>(
  elements: TimelineItem<ElementType>[],
): Timeline<ElementType> {
  // Calculate the total length of the timeline and sort the elements
  const sortedElements = elements
    .slice()
    .sort((a, b) => a.startMilliseconds - b.startMilliseconds);

  // Handle the case where there are no elements
  if (sortedElements.length === 0) {
    return {
      sortedElements: [],
      timelineDurationMilliseconds: 0,
    };
  }

  const start = sortedElements[0].startMilliseconds;
  const end =
    sortedElements[sortedElements.length - 1].endMilliseconds || start;

  return {
    sortedElements,
    timelineDurationMilliseconds: end - start,
  };
}

/**
 * Convert a relative (0 to 1 value) to a time value
 */
export function relativeToTime(lens: TimelineLens, relative: number): number {
  return (
    lens.startMilliseconds +
    relative * (lens.endMilliseconds - lens.startMilliseconds)
  );
}

/**
 * Convert a time value to a relative (0 to 1) value based on the lens
 *
 * This function returns a value between 0 and 1 that represents the relative
 * position of the time value within the lens.
 */
export function timeToRelative(lens: TimelineLens, time: number): number {
  return (
    (time - lens.startMilliseconds) /
    (lens.endMilliseconds - lens.startMilliseconds)
  );
}

/**
 * Find the elements that are visible in the viewport
 */
export function getVisibleElements<ElementType>(
  lens: TimelineLens,
  timeline: Timeline<ElementType>,
): TimelineItem<ElementType>[] {
  // Take advantage of the fact that the elements are sorted by start time
  const { sortedElements } = timeline;

  const start = relativeToTime(lens, 0);
  const end = relativeToTime(lens, 1);

  return sortedElements.filter(
    (element) =>
      element.startMilliseconds < end &&
      (element.endMilliseconds || element.startMilliseconds) > start,
  );
}

/**
 * Create a lens for a timeline
 */
export function createLens(timelineDurationMilliseconds: number): TimelineLens {
  return {
    startMilliseconds: 0,
    endMilliseconds: timelineDurationMilliseconds,

    timelineDurationMilliseconds,
  };
}

/**
 * Zoom in the lens
 */
export function zoomIn(lens: TimelineLens, factor: number): TimelineLens {
  console.assert(factor > 1, "factor must be greater than 1");

  const center = (lens.startMilliseconds + lens.endMilliseconds) / 2;
  const halfLength = (lens.endMilliseconds - lens.startMilliseconds) / 2;

  return {
    ...lens,

    startMilliseconds: Math.round(center - halfLength / factor),
    endMilliseconds: Math.round(center + halfLength / factor),
  };
}
/**
 * Zoom in towards a specific point
 */
export function zoomInTowards(
  lens: TimelineLens,
  factor: number,
  relativeX: number,
): TimelineLens {
  console.assert(factor > 1, "factor must be greater than 1");
  console.assert(relativeX >= 0 && relativeX <= 1, "x must be between 0 and 1");

  const targetCenter = relativeToTime(lens, relativeX);
  const targetWidth = (lens.endMilliseconds - lens.startMilliseconds) / factor;

  const shiftLeft = Math.max(0, targetCenter - targetWidth / 2);

  return {
    ...lens,

    startMilliseconds: Math.round(shiftLeft),
    endMilliseconds: Math.round(shiftLeft + targetWidth),
  };
}

/**
 * Zoom out the lens
 *
 * If the lens would be zoomed out past the entire timeline, the lens should
 * be adjusted to focus on the entire timeline.
 */
export function zoomOut(lens: TimelineLens, factor: number): TimelineLens {
  console.assert(factor > 1, "factor must be greater than 1");

  const center = (lens.startMilliseconds + lens.endMilliseconds) / 2;
  const halfLength = (lens.endMilliseconds - lens.startMilliseconds) / 2;

  return {
    ...lens,

    startMilliseconds: Math.max(Math.round(center - halfLength * factor), 0),
    endMilliseconds: Math.min(
      Math.round(center + halfLength * factor),
      lens.timelineDurationMilliseconds,
    ),
  };
}

/**
 * Zoom out away from a specific point
 *
 * If the lens would be zoomed out past the entire timeline, the lens should
 * be adjusted to focus on the entire timeline.
 */
export function zoomOutTowards(
  lens: TimelineLens,
  factor: number,
  relativeX: number,
): TimelineLens {
  console.assert(factor > 1, "factor must be greater than 1");
  console.assert(relativeX >= 0 && relativeX <= 1, "x must be between 0 and 1");

  const targetCenter = relativeToTime(lens, relativeX);
  const targetWidth = (lens.endMilliseconds - lens.startMilliseconds) * factor;

  const shiftLeft = Math.max(0, targetCenter - targetWidth / 2);

  return {
    ...lens,

    startMilliseconds: Math.round(shiftLeft),
    endMilliseconds: Math.round(shiftLeft + targetWidth),
  };
}

/**
 * Pan the lens to the left
 *
 * If the milliseconds value would cause the lens to go past the start of the
 * timeline, the lens should be adjusted to start at the beginning of the
 * timeline.
 */
export function panLeft(
  lens: TimelineLens,
  milliseconds: number,
): TimelineLens {
  console.assert(milliseconds >= 0, "milliseconds must be positive");

  if (lens.startMilliseconds - milliseconds < 0) {
    return {
      ...lens,

      startMilliseconds: 0,
      endMilliseconds: lens.endMilliseconds - lens.startMilliseconds,
    };
  }

  return {
    ...lens,

    startMilliseconds: lens.startMilliseconds - milliseconds,
    endMilliseconds: lens.endMilliseconds - milliseconds,
  };
}

/**
 * Pan the lens to the right
 *
 * If the milliseconds value would cause the lens to go past the end of the
 * timeline, the lens should be adjusted to end at the end of the timeline.
 */
export function panRight(
  lens: TimelineLens,
  milliseconds: number,
): TimelineLens {
  console.assert(milliseconds >= 0, "milliseconds must be positive");

  if (lens.endMilliseconds + milliseconds > lens.timelineDurationMilliseconds) {
    return {
      ...lens,

      startMilliseconds:
        lens.timelineDurationMilliseconds -
        (lens.endMilliseconds - lens.startMilliseconds),
      endMilliseconds: lens.timelineDurationMilliseconds,
    };
  }

  return {
    ...lens,

    startMilliseconds: lens.startMilliseconds + milliseconds,
    endMilliseconds: lens.endMilliseconds + milliseconds,
  };
}

/**
 * Pan the lens to the left or right based on the sign of the
 * `milliseconds` value. If the value is negative, the lens should be panned to
 * the left. If the value is positive, the lens should be panned to the right.
 */
export function panLens(
  lens: TimelineLens,
  milliseconds: number,
): TimelineLens {
  if (milliseconds < 0) {
    return panLeft(lens, -milliseconds);
  }

  return panRight(lens, milliseconds);
}

/**
 * Reset the lens to focus on the entire timeline
 */
export function resetLens(lens: TimelineLens): TimelineLens {
  return {
    ...lens,

    startMilliseconds: 0,
    endMilliseconds: lens.timelineDurationMilliseconds,
  };
}

/**
 * Get the length of the lens in milliseconds
 */
export function getLensLength(lens: TimelineLens): number {
  return lens.endMilliseconds - lens.startMilliseconds;
}

/**
 * Generate a key for a timeline element
 */
export function generateKey<ElementType>(
  element: TimelineItem<ElementType>,
): string {
  return `${element.type}-${element.startMilliseconds}`;
}
