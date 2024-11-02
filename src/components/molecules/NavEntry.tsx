import TimeLink from "components/atoms/TimeLink";
import { timeHighlightMargin } from "components/organisms/Sidebar";

export default function NavEntry({
  timestamp,
  description,
  onSeekToTime,
  playheadTime,
}: {
  timestamp: number;
  description?: string;
  onSeekToTime: (milliseconds: number) => void;
  playheadTime?: number;
}) {
  const shouldHighlight =
    playheadTime && Math.abs(playheadTime - timestamp) < timeHighlightMargin;

  return (
    <li
      key={`error-${timestamp}`}
      className={`ml-4 ${
        shouldHighlight ? "bg-gray-300 dark:bg-gray-600" : ""
      }`}
    >
      <TimeLink
        className="p-4 text-gray-700 dark:text-gray-200"
        href={`#${timestamp}`}
        milliseconds={timestamp}
        onClick={onSeekToTime}
      >
        {" "}
        - {description?.substring(0, 30)}...
      </TimeLink>
    </li>
  );
}
