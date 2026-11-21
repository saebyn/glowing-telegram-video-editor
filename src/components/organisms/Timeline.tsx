import { useEffect, useRef, useState } from "react";
import {
  type TimelineElementType,
  timelineElementTypeColors,
} from "@/components/atoms/TimelineLegend";
import TimeSegmentMarker from "@/components/atoms/TimeSegmentMarker";
import TimelineElement from "@/components/molecules/TimelineElement";
import { useLens } from "@/context/TimelineContext";
import type { FrameRate, Section, VideoMetadata } from "@/types";
import { formatFrames, snapFrame } from "@/utils/frames";
import { createTimeline, generateKey } from "@/utils/timeline";

export default function Timeline({
  content: {
    chat_history,
    silences,
    highlights,
    attentions,
    transcription_errors,
    frameRate,
    durationFrames,
  },
  playheadFrame,
  onSeekToFrame,
  onItemSelect,
}: {
  content: VideoMetadata;
  playheadFrame: number;
  onSeekToFrame?: (sourceFrame: number) => void;
  onItemSelect?: (item: Section) => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const lens = useLens();

  const [dragging, setDragging] = useState<{
    startedAt: number;
    startX: number;
    framesPerPixel: number;
  } | null>(null);
  const lastPanOffset = useRef(0);
  const [hoverLocation, setHoverLocation] = useState<number | null>(null);

  function isDragging() {
    if (dragging === null) {
      return false;
    }

    return Date.now() - dragging.startedAt > 250;
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const deltaY = event.deltaY;

      // x coordinate of the mouse relative to the container
      const { left, width } = container.getBoundingClientRect();

      if (width <= 0) return;
      const relativeX = Math.max(0, Math.min(1, (event.clientX - left) / width));

      if (deltaY > 0) {
        lens.zoomOut(relativeX);
      } else {
        lens.zoomIn(relativeX);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [lens]);

  const timeline = createTimeline<TimelineElementType>([
    ...silences.map((silence, index) => ({
      type: "silence" as TimelineElementType,
      startFrame: silence.sourceFrame,
      endFrame: silence.sourceOutFrame,
      text: silence.description || "",
      originIndex: index,
    })),
    ...highlights.map((highlight, index) => ({
      type: "highlight" as TimelineElementType,
      startFrame: highlight.sourceFrame,
      endFrame: highlight.sourceOutFrame,
      text: highlight.description || "",
      originIndex: index,
    })),
    ...attentions.map((attention, index) => ({
      type: "attention" as TimelineElementType,
      startFrame: attention.sourceFrame,
      endFrame: attention.sourceOutFrame,
      text: attention.description || "",
      originIndex: index,
    })),
    ...transcription_errors.map((error, index) => ({
      type: "error" as TimelineElementType,
      startFrame: error.sourceFrame,
      endFrame: error.sourceOutFrame,
      text: error.description || "",
      originIndex: index,
    })),
    ...chat_history.map((chat, index) => ({
      type: "chat" as TimelineElementType,
      startFrame: chat.sourceFrame,
      text: chat.username,
      originIndex: index,
    })),
  ]);
  const elements = lens.getVisibleElements(timeline);

  const handleDragStart = (event: React.MouseEvent<HTMLElement>) => {
    const { width } = event.currentTarget.getBoundingClientRect();
    if (width <= 0) return;
    lastPanOffset.current = 0;
    setDragging({
      startedAt: Date.now(),
      startX: event.clientX,
      framesPerPixel: lens.getLength() / width,
    });
  };

  const handleDragEnd = () => setDragging(null);

  const handleGlobalMouseMove = (event: MouseEvent) => {
    if (!dragging || !isDragging()) return;
    setHoverLocation(null);

    const offsetFrames = Math.round((dragging.startX - event.clientX) * dragging.framesPerPixel);
    const deltaFrames = offsetFrames - lastPanOffset.current;
    if (deltaFrames !== 0) {
      lastPanOffset.current = offsetFrames;
      lens.pan(deltaFrames);
    }
  };

  useEffect(() => {
    if (dragging === null) return;
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("mousemove", handleGlobalMouseMove);

    return () => {
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  });

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const { left, width } = container.getBoundingClientRect();
    if (!isDragging() && width > 0) {
      setHoverLocation(Math.max(0, Math.min(1, (event.clientX - left) / width)));
    }
  };

  const handleMouseLeave = () => {
    setHoverLocation(null);
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    /**
     * If the user is dragging, don't seek to the time.
     * Dragging is detected by the movement of the mouse
     * lasting longer than 250ms.
     */
    if (isDragging()) {
      return;
    }

    /**
     * If the user is holding down the shift key, don't seek to the time.
     */
    if (event.shiftKey) {
      return;
    }

    const { left, width } = containerRef.current.getBoundingClientRect();
    if (width <= 0 || durationFrames <= 0) return;

    const relativeClick = Math.max(0, Math.min(1, (event.clientX - left) / width));
    onSeekToFrame?.(snapFrame(lens.relativeToFrame(relativeClick), durationFrames));
  };

  return (
    <section
      aria-label="Source timeline"
      className="relative h-16 cursor-crosshair select-none overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-600"
      ref={containerRef}
      onMouseDown={handleDragStart}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
    >
      <TimelineHover hoverLocation={hoverLocation} lens={lens} frameRate={frameRate} />

      {elements.map((content) => (
        <TimelineElement
          key={generateKey(content)}
          content={content}
          onClick={() => {
            if (onItemSelect) {
              let source: Section[];

              switch (content.type) {
                case "silence":
                  source = silences;
                  break;
                case "highlight":
                  source = highlights;
                  break;
                case "attention":
                  source = attentions;
                  break;
                case "error":
                  source = transcription_errors;
                  break;
                case "chat":
                  source = chat_history;
                  break;
                default:
                  throw new Error("Invalid type");
              }

              onItemSelect(source[content.originIndex] as Section);
            }
          }}
        />
      ))}

      <TimeSegmentMarker
        onClick={() => {}}
        startFrame={playheadFrame}
        text=""
        className={`z-50 h-16 ${timelineElementTypeColors.cursor}`}
      />
    </section>
  );
}

function TimelineHover({
  hoverLocation,
  lens,
  frameRate,
}: {
  hoverLocation: number | null;
  lens: ReturnType<typeof useLens>;
  frameRate: FrameRate;
}) {
  if (hoverLocation === null) {
    return null;
  }

  return (
    <div
      className="p-8 absolute top-0 z-50
        "
      style={{ left: `${hoverLocation * 100}%` }}
    >
      {formatFrames(lens.relativeToFrame(hoverLocation), frameRate)}
    </div>
  );
}
