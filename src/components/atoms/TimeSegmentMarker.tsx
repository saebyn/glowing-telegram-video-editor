import { useState } from "react";
import { useLens } from "../../context/TimelineContext";

export default function TimeSegmentMarker({
  startFrame,
  endFrame,
  text,
  className,
  onClick,
}: {
  startFrame: number;
  endFrame?: number;
  className: string;
  text: string;
  onClick?: () => void;
}) {
  const [isClickable, setIsClickable] = useState(false);
  const { frameToRelative } = useLens();

  const relativeWidth =
    endFrame === undefined ? undefined : frameToRelative(endFrame) - frameToRelative(startFrame);

  const width =
    relativeWidth !== undefined ? `max(${relativeWidth * 100.0}%, 0.125rem)` : "0.125rem";

  const handleHover = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only make the marker clickable if there is an onClick handler
    // and the user is holding down shift
    if (onClick && event.shiftKey) {
      setIsClickable(true);
      return;
    }

    setIsClickable(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) {
      return;
    }

    if (event.shiftKey) {
      setIsClickable(true);
    }
  };

  const handleKeyUp = (_event: React.KeyboardEvent<HTMLDivElement>) => {
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
      onMouseMove={handleHover}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={`absolute top-1/2 size-1 -translate-y-1/2 ${className} ${isClickable ? "cursor-pointer" : ""}`}
      style={{
        left: `${frameToRelative(startFrame) * 100.0}%`,
        width,
      }}
    />
  );
}
