import type React from "react";

function Button({
  children,
  variant = "default",
  className,
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "primary" | "danger" | "secondary" | "default";
}) {
  const variantClass = getVariantClass(variant);

  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter") {
      onClick?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={props.tabIndex ?? 0}
      className={`mx-2 rounded px-5 py-3 max-h-12 ${variantClass} disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-200 disabled:hover:text-gray-400 disabled:active:bg-gray-200 disabled:active:text-gray-400 disabled:dark:bg-gray-700 disabled:dark:text-gray-400 disabled:dark:hover:bg-gray-700 disabled:dark:hover:text-gray-400 disabled:dark:active:bg-gray-700 disabled:dark:active:text-gray-400 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function getVariantClass(
  variant: "primary" | "danger" | "secondary" | "default",
) {
  switch (variant) {
    case "primary":
      return "bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 active:bg-blue-700 dark:hover:bg-blue-700 dark:active:bg-blue-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white";
    case "danger":
      return "bg-red-500 dark:bg-red-600 hover:bg-red-600 active:bg-red-700 dark:hover:bg-red-700 dark:active:bg-red-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white";
    case "secondary":
      return "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 active:bg-gray-500 dark:hover:bg-gray-600 dark:active:bg-gray-700 hover:text-black active:text-black dark:hover:text-white dark:active:text-white";
    default:
      return "bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 active:bg-gray-700 dark:hover:bg-gray-700 dark:active:bg-gray-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white";
  }
}

export default Button;
