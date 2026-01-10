import { TimeDotMarker } from "@/components/atoms/TimeDotMarker";
import {
  type TimelineElementType,
  timelineElementTypeColors,
} from "@/components/atoms/TimelineLegend";
import TimeSegmentMarker from "@/components/atoms/TimeSegmentMarker";
import type { TimelineItem } from "@/utils/timeline";

interface TimelineElementProps {
  content: TimelineItem<TimelineElementType>;
  onClick: () => void;
}
export default function TimelineElement({
  content: { startMilliseconds, endMilliseconds, type, text },
  onClick,
}: TimelineElementProps) {
  if (type === "chat") {
    return (
      <TimeDotMarker
        timestampMilliseconds={startMilliseconds}
        className={`z-40 ${timelineElementTypeColors[type]}`}
      />
    );
  }

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
      onClick={onClick}
      startMilliseconds={startMilliseconds}
      endMilliseconds={endMilliseconds}
      className={className}
      text={text}
    />
  );
}
