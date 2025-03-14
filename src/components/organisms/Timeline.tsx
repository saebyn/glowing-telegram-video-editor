import TimeSegmentMarker from "@/components/atoms/TimeSegmentMarker";
import {
  type TimelineElementType,
  timelineElementTypeColors,
} from "@/components/atoms/TimelineLegend";
import TimelineElement from "@/components/molecules/TimelineElement";
import { useLens } from "@/context/TimelineContext";
import type { Section, VideoMetadata } from "@/types";
import { formatMs } from "@/utils/duration";
import { createTimeline, generateKey } from "@/utils/timeline";
import { useEffect, useRef, useState } from "react";

export default function Timeline({
  content: {
    chat_history,
    silences,
    highlights,
    attentions,
    transcription_errors,
  },
  playheadTime,
  onSeekToTime,
  onItemSelect,
}: {
  content: VideoMetadata;
  playheadTime: number;
  onSeekToTime?: (time: number) => void;
  onItemSelect?: (item: Section) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lens = useLens();

  const [dragging, setDragging] = useState<number | null>(null);
  const [hoverLocation, setHoverLocation] = useState<number | null>(null);

  function isDragging() {
    if (dragging === null) {
      return false;
    }

    return new Date().getTime() - dragging > 250;
  }

  useEffect(() => {
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("mousemove", handleGlobalMouseMove);

    return () => {
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  });

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const deltaY = event.deltaY;

      // x coordinate of the mouse relative to the container
      const x = event.pageX - container.offsetLeft;

      // relativeX is the x coordinate of the mouse relative to the container width
      const relativeX = x / container.clientWidth;

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
      startMilliseconds: silence.timestamp,
      endMilliseconds: silence.timestamp_end && silence.timestamp_end,
      text: silence.description || "",
      originIndex: index,
    })),
    ...highlights.map((highlight, index) => ({
      type: "highlight" as TimelineElementType,
      startMilliseconds: highlight.timestamp,
      endMilliseconds: highlight.timestamp_end && highlight.timestamp_end,
      text: highlight.description || "",
      originIndex: index,
    })),
    ...attentions.map((attention, index) => ({
      type: "attention" as TimelineElementType,
      startMilliseconds: attention.timestamp,
      endMilliseconds: attention.timestamp_end && attention.timestamp_end,
      text: attention.description || "",
      originIndex: index,
    })),
    ...transcription_errors.map((error, index) => ({
      type: "error" as TimelineElementType,
      startMilliseconds: error.timestamp,
      endMilliseconds: error.timestamp_end && error.timestamp_end,
      text: error.description || "",
      originIndex: index,
    })),
    ...chat_history.map((chat, index) => ({
      type: "chat" as TimelineElementType,
      startMilliseconds: chat.timestamp,
      text: chat.username,
      originIndex: index,
    })),
  ]);
  const elements = lens.getVisibleElements(timeline);

  const handleDragStart = () => {
    setDragging(new Date().getTime());
  };

  const handleDragEnd = (e: MouseEvent) => {
    e.preventDefault();

    setDragging(null);
  };

  const handleGlobalMouseMove = (event: MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    if (isDragging()) {
      setHoverLocation(null);

      const { movementX } = event;

      const relativeMovement = movementX / container.clientWidth;
      const deltaMs = Math.round(-relativeMovement * lens.getLength());

      lens.pan(deltaMs);
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    if (!isDragging()) {
      // Set the hover state with the location
      // x coordinate of the mouse relative to the container
      const x = event.pageX - container.offsetLeft;

      // relativeX is the x coordinate of the mouse relative to the container width
      const relativeX = x / container.clientWidth;

      setHoverLocation(relativeX);
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

    const containerPixelWidth = containerRef.current.clientWidth;

    const offsetXInContainer = event.pageX - containerRef.current.offsetLeft;

    const relativeClick = offsetXInContainer / containerPixelWidth;
    const clickMs = Math.round(lens.relativeToTime(relativeClick));

    if (onSeekToTime) {
      onSeekToTime(clickMs);
    }
  };

  return (
    <div
      className="relative h-16 cursor-crosshair select-none overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-600"
      ref={containerRef}
      onMouseDown={handleDragStart}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
    >
      <TimelineHover hoverLocation={hoverLocation} lens={lens} />

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
        startMilliseconds={playheadTime}
        endMilliseconds={undefined}
        text=""
        className={`z-50 h-16 ${timelineElementTypeColors.cursor}`}
      />
    </div>
  );
}

function TimelineHover({
  hoverLocation,
  lens,
}: {
  hoverLocation: number | null;
  lens: ReturnType<typeof useLens>;
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
      {formatMs(lens.relativeToTime(hoverLocation))}
    </div>
  );
}
