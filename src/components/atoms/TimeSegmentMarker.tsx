import { useLens } from "../../context/TimelineContext";

export default function TimeSegmentMarker({
  startMilliseconds,
  endMilliseconds,
  text,
  className,
  onClick,
}: {
  startMilliseconds: number;
  endMilliseconds: number | undefined;
  className: string;
  text: string;
  onClick?: () => void;
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
      title={text}
      onClick={onClick}
      className={`absolute top-1/2 size-1 -translate-y-1/2 ${className}`}
      style={{
        left: `${timeToRelative(startMilliseconds) * 100.0}%`,
        width,
      }}
    />
  );
}
