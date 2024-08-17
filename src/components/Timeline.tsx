import { VideoMetadata } from "types";
import {
  createTimeline,
  TimelineItem,
  TimelineLens,
  generateKey,
  getVisibleElements,
  timeToRelative,
  zoomIn,
  zoomOut,
  resetLens,
  createLens,
  panLens,
  getLensLength,
} from "utils/timeline";
import Button from "./Button";
import { useEffect, useRef, useState } from "react";

type TimelineElementType =
  | "cursor"
  | "silence"
  | "chat"
  | "highlight"
  | "attention"
  | "error";

const timelineElementTypeColors: Record<TimelineElementType, string> = {
  silence: "bg-gray-700 dark:bg-gray-900",
  chat: "bg-gray-500 dark:bg-gray-300",
  highlight: "bg-blue-500 dark:bg-blue-300",
  attention: "bg-red-500 dark:bg-red-300",
  error: "bg-yellow-500 dark:bg-yellow-300",
  cursor: "bg-green-500 dark:bg-green-300",
};

function barWidthStyle(
  lens: TimelineLens,
  startMilliseconds: number,
  endMilliseconds: number | undefined,
): string {
  if (endMilliseconds === undefined) {
    return "0.125rem";
  }

  const relativeStart = timeToRelative(lens, startMilliseconds);
  const relativeEnd = timeToRelative(lens, endMilliseconds);
  const relativeWidth = relativeEnd - relativeStart;

  return `max(${relativeWidth * 100.0}%, 0.125rem)`;
}

function TimeSegmentMarker({
  startMilliseconds,
  endMilliseconds,
  lens,
  className,
}: {
  startMilliseconds: number;
  endMilliseconds: number | undefined;
  lens: TimelineLens;
  className: string;
}) {
  return (
    <div
      className={`absolute top-1/2 size-1 -translate-y-1/2 ${className}`}
      style={{
        left: `${timeToRelative(lens, startMilliseconds) * 100.0}%`,
        width: barWidthStyle(lens, startMilliseconds, endMilliseconds),
      }}
    />
  );
}

function TimeDotMarker({
  timestampMilliseconds,
  lens,
  className,
}: {
  timestampMilliseconds: number;
  lens: TimelineLens;
  className: string;
}) {
  return (
    <div
      className={`absolute top-1/2 size-1 h-1 -translate-y-1/2 ${className}`}
      style={{
        left: `calc(${
          timeToRelative(lens, timestampMilliseconds) * 100.0
        }% - 0.125rem)`,
      }}
    />
  );
}

interface TimelineElementProps {
  lens: TimelineLens;
  content: TimelineItem<TimelineElementType>;
}

function TimelineElement({
  lens,
  content: { startMilliseconds, endMilliseconds, type },
}: TimelineElementProps) {
  if (type === "chat") {
    return (
      <TimeDotMarker
        timestampMilliseconds={startMilliseconds}
        lens={lens}
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
        lens={lens}
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
    length: contentLength,
  },
  playbackTime,
  onSeekToTime,
}: {
  content: VideoMetadata;
  playbackTime: number;
  onSeekToTime?: (time: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<TimelineLens>(createLens(contentLength));
  const [dragging, setDragging] = useState(false);

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

    container.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();

        const deltaY = event.deltaY;

        if (deltaY > 0) {
          handleZoomOut();
        } else {
          handleZoomIn();
        }
      },
      { passive: false },
    );

    return () => {
      container.removeEventListener("wheel", () => {});
    };
  }, [containerRef]);

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
  const elements = getVisibleElements(lens, timeline);

  const zoomFactor = 1.1;

  const handleZoomIn = () => {
    setLens((lens) => zoomIn(lens, zoomFactor));
  };

  const handleZoomOut = () => {
    setLens((lens) => zoomOut(lens, zoomFactor));
  };

  const handleReset = () => {
    setLens((lens) => resetLens(lens));
  };

  const handleDragStart = () => {
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  const handleDrag = (event: MouseEvent) => {
    if (!dragging) {
      return;
    }

    if (!containerRef.current) {
      return;
    }

    const { movementX } = event;

    const containerPixelWidth = containerRef.current.clientWidth;
    const relativeMovement = movementX / containerPixelWidth;
    const deltaMs = Math.round(-relativeMovement * getLensLength(lens));

    setLens((lens) => panLens(lens, deltaMs));
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    if (!containerRef.current) {
      return;
    }

    const containerPixelWidth = containerRef.current.clientWidth;
    const relativeClick = event.nativeEvent.offsetX / containerPixelWidth;
    const clickMs = Math.round(relativeClick * getLensLength(lens));

    console.log(clickMs);

    if (onSeekToTime) {
      onSeekToTime(clickMs);
    }
  };

  return (
    <>
      <div
        className="relative h-16 cursor-pointer select-none overflow-hidden rounded bg-gray-200 dark:bg-gray-600"
        ref={containerRef}
        onClick={handleContainerClick}
        onMouseDown={handleDragStart}
      >
        {elements.map((content) => (
          <TimelineElement
            key={generateKey(content)}
            lens={lens}
            content={content}
          />
        ))}

        <TimeSegmentMarker
          startMilliseconds={playbackTime}
          endMilliseconds={undefined}
          lens={lens}
          className={`z-50 h-16 ${timelineElementTypeColors.cursor}`}
        />
      </div>
      <div className="mt-4">
        <TimelineLegend />

        <Button onClick={handleZoomIn}>Zoom In</Button>
        <Button
          className="mx-2 rounded bg-gray-300 px-4 py-2 dark:bg-gray-400"
          onClick={handleZoomOut}
        >
          Zoom Out
        </Button>
        <Button
          className="mx-2 rounded bg-gray-300 px-4 py-2 dark:bg-gray-400"
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>
    </>
  );
}

export function TimelineLegend() {
  return (
    <div
      className="my-8 flex space-x-4 text-sm text-gray-800
     dark:text-gray-200
    "
    >
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.silence}`}
        ></div>
        <span>Silence segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.chat}`}
        ></div>
        <span>Chat message</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.highlight}`}
        ></div>
        <span>Highlighted segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.attention}`}
        ></div>
        <span>Attention segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.error}`}
        ></div>
        <span>Transcript error</span>
      </div>
    </div>
  );
}
