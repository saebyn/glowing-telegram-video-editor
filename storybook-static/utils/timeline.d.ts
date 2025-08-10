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
    originIndex: number;
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
export declare function createTimeline<ElementType>(elements: TimelineItem<ElementType>[]): Timeline<ElementType>;
/**
 * Convert a relative (0 to 1 value) to a time value
 */
export declare function relativeToTime(lens: TimelineLens, relative: number): number;
/**
 * Convert a time value to a relative (0 to 1) value based on the lens
 *
 * This function returns a value between 0 and 1 that represents the relative
 * position of the time value within the lens.
 */
export declare function timeToRelative(lens: TimelineLens, time: number): number;
/**
 * Find the elements that are visible in the viewport
 */
export declare function getVisibleElements<ElementType>(lens: TimelineLens, timeline: Timeline<ElementType>): TimelineItem<ElementType>[];
/**
 * Create a lens for a timeline
 */
export declare function createLens(timelineDurationMilliseconds: number): TimelineLens;
/**
 * Zoom in the lens
 */
export declare function zoomIn(lens: TimelineLens, factor: number): TimelineLens;
/**
 * Zoom in towards a specific point
 */
export declare function zoomInTowards(lens: TimelineLens, factor: number, relativeX: number): TimelineLens;
/**
 * Zoom out the lens
 *
 * If the lens would be zoomed out past the entire timeline, the lens should
 * be adjusted to focus on the entire timeline.
 */
export declare function zoomOut(lens: TimelineLens, factor: number): TimelineLens;
/**
 * Zoom out away from a specific point
 *
 * If the lens would be zoomed out past the entire timeline, the lens should
 * be adjusted to focus on the entire timeline.
 */
export declare function zoomOutTowards(lens: TimelineLens, factor: number, relativeX: number): TimelineLens;
/**
 * Pan the lens to the left
 *
 * If the milliseconds value would cause the lens to go past the start of the
 * timeline, the lens should be adjusted to start at the beginning of the
 * timeline.
 */
export declare function panLeft(lens: TimelineLens, milliseconds: number): TimelineLens;
/**
 * Pan the lens to the right
 *
 * If the milliseconds value would cause the lens to go past the end of the
 * timeline, the lens should be adjusted to end at the end of the timeline.
 */
export declare function panRight(lens: TimelineLens, milliseconds: number): TimelineLens;
/**
 * Pan the lens to the left or right based on the sign of the
 * `milliseconds` value. If the value is negative, the lens should be panned to
 * the left. If the value is positive, the lens should be panned to the right.
 */
export declare function panLens(lens: TimelineLens, milliseconds: number): TimelineLens;
/**
 * Reset the lens to focus on the entire timeline
 */
export declare function resetLens(lens: TimelineLens): TimelineLens;
/**
 * Get the length of the lens in milliseconds
 */
export declare function getLensLength(lens: TimelineLens): number;
/**
 * Generate a key for a timeline element
 */
export declare function generateKey<ElementType>(element: TimelineItem<ElementType>): string;
