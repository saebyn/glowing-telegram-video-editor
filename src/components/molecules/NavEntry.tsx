import TimeLink from "@/components/atoms/TimeLink";
import type { FrameRate } from "@/types";
import { secondsToFrame } from "@/utils/frames";

export default function NavEntry({
  sourceFrame,
  description,
  onSeekToFrame,
  playheadFrame,
  frameRate,
}: {
  sourceFrame: number;
  description?: string;
  onSeekToFrame: (sourceFrame: number) => void;
  playheadFrame?: number;
  frameRate: FrameRate;
}) {
  const shouldHighlight =
    playheadFrame !== undefined &&
    Math.abs(playheadFrame - sourceFrame) < secondsToFrame(5, frameRate);

  return (
    <li
      key={`error-${sourceFrame}`}
      className={`ml-4 ${shouldHighlight ? "bg-gray-300 dark:bg-gray-600" : ""}`}
    >
      <TimeLink
        className="p-4 text-gray-700 dark:text-gray-200"
        href={`#${sourceFrame}`}
        frame={sourceFrame}
        frameRate={frameRate}
        onClick={onSeekToFrame}
      >
        {" "}
        - {description?.substring(0, 30)}...
      </TimeLink>
    </li>
  );
}
