import type { HTMLAttributes, JSX } from "react";

type HeadingProps = React.PropsWithChildren<
  HTMLAttributes<HTMLHeadingElement>
> & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

const levelStyles = {
  1: "text-3xl",
  2: "text-xl",
  3: "text-xl",
  4: "text-lg",
  5: "text-base",
  6: "text-sm",
};

export default function Heading({ level, children, ...props }: HeadingProps) {
  const HElement = `h${level || 1}` as JSX.ElementType;

  return (
    <HElement
      className={`mb-4 font-bold text-gray-800 dark:text-white ${
        levelStyles[level || 1]
      }`}
      {...props}
    >
      {children}
    </HElement>
  );
}
