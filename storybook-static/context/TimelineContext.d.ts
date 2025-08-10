import { Timeline, TimelineItem } from '../utils/timeline';
import { ReactNode } from '../../node_modules/react';
interface TimelineProviderProps {
    children: ReactNode;
    /**
     * The total length of the content in milliseconds.
     */
    contentLength: number;
}
export declare const TimelineProvider: ({ children, contentLength, }: TimelineProviderProps) => import("react/jsx-runtime").JSX.Element;
interface TimelineHookResult {
    timeToRelative(time: number): number;
    relativeToTime(relative: number): number;
    pan(deltaMs: number): void;
    zoomIn(relativeX: number): void;
    zoomOut(relativeX: number): void;
    reset(): void;
    getVisibleElements<T>(timeline: Timeline<T>): TimelineItem<T>[];
    getLength(): number;
    debug(): void;
}
export declare const useLens: () => TimelineHookResult;
export {};
