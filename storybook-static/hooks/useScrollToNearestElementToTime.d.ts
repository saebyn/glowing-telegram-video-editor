import { LogEvent } from '../types';
/**
 * A hook that finds the nearest element to the given time in the log
 * and scrolls the element into view.
 *
 */
export default function useScrollToNearestElementToTime<T extends LogEvent>(time: number, ref: React.RefObject<HTMLDivElement | null>, log: T[], followPlayback: boolean): number | null;
