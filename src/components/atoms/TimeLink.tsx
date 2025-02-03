import type React from "react";

import { formatMs, msToIso } from "utils/duration";

interface TimeLinkProps {
  milliseconds?: number;
  onClick?: (milliseconds: number) => void;
  children?: React.ReactNode;
  href?: string;
  className?: string;
}

export default function TimeLink({
  milliseconds,
  onClick,
  children,
  href,
  className,
}: TimeLinkProps) {
  if (milliseconds === undefined) {
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
          onClick(milliseconds);
        }}
      >
        <time dateTime={msToIso(milliseconds)}>{formatMs(milliseconds)}</time>
        &nbsp;
        {children}
      </a>
    );
  }
  return (
    <>
      {formatMs(milliseconds)}&nbsp;
      {children}
    </>
  );
}
