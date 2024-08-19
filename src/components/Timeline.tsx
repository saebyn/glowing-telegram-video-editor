import { VideoMetadata } from "types";
import { createTimeline, generateKey, TimelineItem } from "utils/timeline";
import { useEffect, useRef, useState } from "react";
import { useLens } from "./TimelineContext";
import {
  TimelineElementType,
  timelineElementTypeColors,
} from "./TimelineLegend";

function TimeSegmentMarker({
  startMilliseconds,
  endMilliseconds,
  className,
}: {
  startMilliseconds: number;
  endMilliseconds: number | undefined;
  className: string;
}) {
  const { timeToRelative } = useLens();

  const relativeWidth =
    endMilliseconds &&
    timeToRelative(endMilliseconds) - timeToRelative(startMilliseconds);

  const width =
    relativeWidth !== undefined
      ? `max(${relativeWidth * 100.0}%, 0.125rem)`
      : "0.125rem";

  return (
    <div
      className={`absolute top-1/2 size-1 -translate-y-1/2 ${className}`}
      style={{
        left: `${timeToRelative(startMilliseconds) * 100.0}%`,
        width,
      }}
    />
  );
}

function TimeDotMarker({
  timestampMilliseconds,
  className,
}: {
  timestampMilliseconds: number;
  className: string;
}) {
  const { timeToRelative } = useLens();
  return (
    <div
      className={`absolute top-1/2 size-1 h-1 -translate-y-1/2 ${className}`}
      style={{
        left: `calc(${
          timeToRelative(timestampMilliseconds) * 100.0
        }% - 0.125rem)`,
      }}
    />
  );
}

interface TimelineElementProps {
  content: TimelineItem<TimelineElementType>;
}

function TimelineElement({
  content: { startMilliseconds, endMilliseconds, type },
}: TimelineElementProps) {
  if (type === "chat") {
    return (
      <TimeDotMarker
        timestampMilliseconds={startMilliseconds}
        className={`z-40 ${timelineElementTypeColors[type]}`}
      />
    );
  } else {
    let className = "";
    if (type === "silence") {
      className = "z-0 h-16 ";
    } else if (type === "highlight") {
      className = "z-10 h-12 ";
    } else if (type === "attention") {
      className = "z-20 h-10 ";
    } else if (type === "error") {
      className = "z-30 h-8 ";
    }

    className += timelineElementTypeColors[type];

    return (
      <TimeSegmentMarker
        startMilliseconds={startMilliseconds}
        endMilliseconds={endMilliseconds}
        className={className}
      />
    );
  }
}

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
}: {
  content: VideoMetadata;
  playheadTime: number;
  onSeekToTime?: (time: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lens = useLens();

  const [dragging, setDragging] = useState(0);

  useEffect(() => {
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("mousemove", handleDrag);

    return () => {
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("mousemove", handleDrag);
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

      if (deltaY > 0) {
        lens.zoomOut();
      } else {
        lens.zoomIn();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [containerRef, lens]);

  const timeline = createTimeline<TimelineElementType>([
    ...silences.map((silence) => ({
      type: "silence" as TimelineElementType,
      startMilliseconds: silence.timestamp,
      endMilliseconds: silence.timestamp_end && silence.timestamp_end,
    })),
    ...highlights.map((highlight) => ({
      type: "highlight" as TimelineElementType,
      startMilliseconds: highlight.timestamp,
      endMilliseconds: highlight.timestamp_end && highlight.timestamp_end,
    })),
    ...attentions.map((attention) => ({
      type: "attention" as TimelineElementType,
      startMilliseconds: attention.timestamp,
      endMilliseconds: attention.timestamp_end && attention.timestamp_end,
    })),
    ...transcription_errors.map((error) => ({
      type: "error" as TimelineElementType,
      startMilliseconds: error.timestamp,
      endMilliseconds: error.timestamp_end && error.timestamp_end,
    })),
    ...chat_history.map((chat) => ({
      type: "chat" as TimelineElementType,
      startMilliseconds: chat.timestamp,
    })),
  ]);
  const elements = lens.getVisibleElements(timeline);

  const handleDragStart = () => {
    setDragging(new Date().getTime());
  };

  const handleDragEnd = (e: MouseEvent) => {
    e.preventDefault();

    setTimeout(() => {
      setDragging(0);
    }, 0);
  };

  const handleDrag = (event: MouseEvent) => {
    if (dragging === 0) {
      return;
    }

    if (!containerRef.current) {
      return;
    }

    const { movementX } = event;

    const containerPixelWidth = containerRef.current.clientWidth;
    const relativeMovement = movementX / containerPixelWidth;
    const deltaMs = Math.round(-relativeMovement * lens.getLength());

    lens.pan(deltaMs);
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    /**
     * If the user is dragging, don't seek to the time.
     * Dragging is detected by the mouse moving more than 250ms
     */
    if (new Date().getTime() - dragging > 250) {
      return;
    }

    const containerPixelWidth = containerRef.current.clientWidth;

    const offsetXInContainer = event.pageX - containerRef.current.offsetLeft;

    const relativeClick = offsetXInContainer / containerPixelWidth;
    const clickMs = Math.round(relativeClick * lens.getLength());

    if (onSeekToTime) {
      onSeekToTime(clickMs);
    }
  };

  return (
    <div
      className="relative h-16 cursor-pointer select-none overflow-hidden rounded bg-gray-200 dark:bg-gray-600"
      ref={containerRef}
      onMouseDown={handleDragStart}
      onClick={handleContainerClick}
    >
      {elements.map((content) => (
        <TimelineElement key={generateKey(content)} content={content} />
      ))}

      <TimeSegmentMarker
        startMilliseconds={playheadTime}
        endMilliseconds={undefined}
        className={`z-50 h-16 ${timelineElementTypeColors.cursor}`}
      />
    </div>
  );
}
