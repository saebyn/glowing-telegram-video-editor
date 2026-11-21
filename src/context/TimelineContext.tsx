import type React from "react";
import { createContext, type ReactNode, useContext, useState } from "react";
import {
  createLens,
  frameToRelative,
  getLensLength,
  getVisibleElements,
  panLens,
  relativeToFrame,
  resetLens,
  type Timeline,
  type TimelineItem,
  type TimelineLens,
  zoomInTowards,
  zoomOutTowards,
} from "@/utils/timeline";

interface TimelineContextProps {
  lens: TimelineLens;
  setLens: React.Dispatch<React.SetStateAction<TimelineLens>>;
}

const TimelineContext = createContext<TimelineContextProps | undefined>(undefined);

interface TimelineProviderProps {
  children: ReactNode;
  /**
   * The total length of the source in frames.
   */
  durationFrames: number;
}

export const TimelineProvider = ({ children, durationFrames }: TimelineProviderProps) => {
  const [lens, setLens] = useState<TimelineLens>(() => createLens(durationFrames));
  if (lens.durationFrames !== durationFrames) {
    setLens(createLens(durationFrames));
  }

  return <TimelineContext.Provider value={{ lens, setLens }}>{children}</TimelineContext.Provider>;
};

const zoomFactor = 1.1;

interface TimelineHookResult {
  frameToRelative(frame: number): number;
  relativeToFrame(relative: number): number;
  pan(offsetFrames: number): void;
  zoomIn(relativeX: number): void;
  zoomOut(relativeX: number): void;
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
    frameToRelative(frame: number) {
      return frameToRelative(context.lens, frame);
    },
    relativeToFrame(relative: number) {
      return relativeToFrame(context.lens, relative);
    },
    pan(offsetFrames: number) {
      context.setLens((lens) => panLens(lens, offsetFrames));
    },
    zoomIn(relativeX: number) {
      context.setLens((lens) => zoomInTowards(lens, zoomFactor, relativeX));
    },
    zoomOut(relativeX: number) {
      context.setLens((lens) => zoomOutTowards(lens, zoomFactor, relativeX));
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
