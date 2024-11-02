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
      className={`mx-2 rounded bg-gray-300 px-4 py-2 dark:bg-gray-400 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
