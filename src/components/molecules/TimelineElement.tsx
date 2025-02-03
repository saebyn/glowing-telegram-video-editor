import type { TimelineItem } from "utils/timeline";
import { TimeDotMarker } from "../atoms/TimeDotMarker";
import TimeSegmentMarker from "../atoms/TimeSegmentMarker";
import {
  type TimelineElementType,
  timelineElementTypeColors,
} from "../atoms/TimelineLegend";

interface TimelineElementProps {
  content: TimelineItem<TimelineElementType>;
}
export default function TimelineElement({
  content: { startMilliseconds, endMilliseconds, type, text },
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
      startMilliseconds={startMilliseconds}
      endMilliseconds={endMilliseconds}
      className={className}
      text={text}
    />
  );
}
