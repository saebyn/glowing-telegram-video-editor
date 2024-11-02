import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import {
  type Timeline,
  type TimelineItem,
  type TimelineLens,
  createLens,
  getLensLength,
  getVisibleElements,
  panLens,
  relativeToTime,
  resetLens,
  timeToRelative,
  zoomIn,
  zoomOut,
} from "utils/timeline";

interface TimelineContextProps {
  lens: TimelineLens;
  setLens: React.Dispatch<React.SetStateAction<TimelineLens>>;
}

const TimelineContext = createContext<TimelineContextProps | undefined>(
  undefined,
);

interface TimelineProviderProps {
  children: ReactNode;
  /**
   * The total length of the content in milliseconds.
   */
  contentLength: number;
}

export const TimelineProvider = ({
  children,
  contentLength,
}: TimelineProviderProps) => {
  const [lens, setLens] = useState<TimelineLens>(createLens(contentLength));

  return (
    <TimelineContext.Provider value={{ lens, setLens }}>
      {children}
    </TimelineContext.Provider>
  );
};

const zoomFactor = 1.1;

interface TimelineHookResult {
  timeToRelative(time: number): number;
  relativeToTime(relative: number): number;
  pan(deltaMs: number): void;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  getVisibleElements<T>(timeline: Timeline<T>): TimelineItem<T>[];
  getLength(): number;
  debug(): void;
}

export const useLens = (): TimelineHookResult => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useLens must be used within a TimelineProvider");
  }
  return {
    timeToRelative(time: number) {
      return timeToRelative(context.lens, time);
    },
    relativeToTime(relative: number) {
      return relativeToTime(context.lens, relative);
    },
    pan(deltaMs: number) {
      context.setLens((lens) => panLens(lens, deltaMs));
    },
    zoomIn() {
      context.setLens((lens) => zoomIn(lens, zoomFactor));
    },
    zoomOut() {
      context.setLens((lens) => zoomOut(lens, zoomFactor));
    },
    reset() {
      context.setLens((lens) => resetLens(lens));
    },
    getVisibleElements(timeline) {
      return getVisibleElements(context.lens, timeline);
    },
    getLength() {
      return getLensLength(context.lens);
    },
    debug() {
      console.log({
        lens: JSON.stringify(context.lens, null, 2),
        zoomFactor,
      });
    },
  };
};
