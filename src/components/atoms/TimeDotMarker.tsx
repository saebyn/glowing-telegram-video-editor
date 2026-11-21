import { useLens } from "@/context/TimelineContext";

export function TimeDotMarker({
  sourceFrame,
  className,
}: {
  sourceFrame: number;
  className: string;
}) {
  const { frameToRelative } = useLens();
  return (
    <div
      className={`absolute top-1/2 size-1 h-1 -translate-y-1/2 ${className}`}
      style={{
        left: `calc(${frameToRelative(sourceFrame) * 100.0}% - 0.125rem)`,
      }}
    />
  );
}
