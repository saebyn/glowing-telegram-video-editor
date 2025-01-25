import { useLens } from "context/TimelineContext";

export function TimeDotMarker({
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
