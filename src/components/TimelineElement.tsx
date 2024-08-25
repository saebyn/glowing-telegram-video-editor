import { TimelineItem } from "utils/timeline";
import { TimeDotMarker } from "./TimeDotMarker";
import {
  TimelineElementType,
  timelineElementTypeColors,
} from "./TimelineLegend";
import TimeSegmentMarker from "./TimeSegmentMarker";

interface TimelineElementProps {
  content: TimelineItem<TimelineElementType>;
}
export default function TimelineElement({
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
