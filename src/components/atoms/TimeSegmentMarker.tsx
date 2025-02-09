import { useState } from "react";
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
  const [isClickable, setIsClickable] = useState(false);
  const { timeToRelative } = useLens();

  const relativeWidth =
    endMilliseconds &&
    timeToRelative(endMilliseconds) - timeToRelative(startMilliseconds);

  const width =
    relativeWidth !== undefined
      ? `max(${relativeWidth * 100.0}%, 0.125rem)`
      : "0.125rem";

  const handleHover = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only make the marker clickable if there is an onClick handler
    // and the user is holding down shift
    if (onClick && event.shiftKey) {
      setIsClickable(true);
      return;
    }

    setIsClickable(false);
  };

  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  return (
    <div
      title={text}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseLeave={handleHover}
      className={`absolute top-1/2 size-1 -translate-y-1/2 ${className} ${isClickable ? "cursor-pointer" : ""}`}
      style={{
        left: `${timeToRelative(startMilliseconds) * 100.0}%`,
        width,
      }}
    />
  );
}
