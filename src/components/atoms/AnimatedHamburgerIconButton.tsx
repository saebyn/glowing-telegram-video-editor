interface AnimatedHamburgerIconButtonProps {
  isExpanded: boolean;
  onClick: () => void;
}

export default function AnimatedHamburgerIconButton({
  isExpanded,
  onClick,
}: AnimatedHamburgerIconButtonProps) {
  return (
    <button
      type="button"
      className=" p-6 "
      onClick={onClick}
      aria-label="Toggle navigation menu"
    >
      <div
        className={clsx(
          "my-1 h-1 w-8 bg-gray-800 transition-transform dark:bg-gray-200",
          {
            "rotate-45 translate-y-2": isExpanded,
          },
        )}
      />
      <div
        className={clsx(
          "my-1 h-1 w-8  bg-gray-800 transition-transform dark:bg-gray-200",
          {
            "opacity-0": isExpanded,
          },
        )}
      />
      <div
        className={clsx(
          "my-1 h-1 w-8  bg-gray-800 transition-transform dark:bg-gray-200",
          {
            "-rotate-45 -translate-y-2": isExpanded,
          },
        )}
      />
    </button>
  );
}

function clsx(...args: (string | { [key: string]: boolean })[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      return Object.entries(arg)
        .filter(([_, value]) => value)
        .map(([key]) => key)
        .join(" ");
    })
    .join(" ");
}
