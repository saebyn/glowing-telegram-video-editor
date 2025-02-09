import type React from "react";

function Button({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`mx-2 rounded bg-gray-300 px-5 py-3 dark:bg-gray-400 hover:bg-gray-400 active:bg-gray-500 dark:hover:bg-gray-500 dark:active:bg-gray-600 hover:text-white active:text-white dark:hover:text-white dark:active:text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
