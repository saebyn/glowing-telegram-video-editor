import type React from "react";

import type { FrameRate } from "@/types";
import { secondsToDuration } from "@/utils/duration";
import { formatFrames, framesToSeconds } from "@/utils/frames";

interface TimeLinkProps {
  frame?: number;
  frameRate: FrameRate;
  onClick?: (frame: number) => void;
  children?: React.ReactNode;
  href?: string;
  className?: string;
}

export default function TimeLink({
  frame,
  frameRate,
  onClick,
  children,
  href,
  className,
}: TimeLinkProps) {
  if (frame === undefined || !Number.isSafeInteger(frame) || frame < 0) {
    return null;
  }

  if (onClick) {
    return (
      <a
        href={href || "#"}
        className={
          className
            ? className
            : `text-blue-500
        underline
        dark:text-blue-300`
        }
        onClick={(e) => {
          e.preventDefault();
          onClick(frame);
        }}
      >
        <time dateTime={secondsToDuration(framesToSeconds(frame, frameRate)).toString()}>
          {formatFrames(frame, frameRate)}
        </time>
        &nbsp;
        {children}
      </a>
    );
  }
  return (
    <>
      {formatFrames(frame, frameRate)}&nbsp;
      {children}
    </>
  );
}
