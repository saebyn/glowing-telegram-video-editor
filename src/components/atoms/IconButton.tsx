import type React from "react";

function IconButton({
  icon,
  className,
  text,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  className?: string;
  icon: string;
  text?: string;
}) {
  return (
    <button
      className={`flex items-center rounded bg-gray-300 dark:bg-gray-400 hover:bg-gray-400 active:bg-gray-500 dark:hover:bg-gray-500 dark:active:bg-gray-600 hover:text-white active:text-white dark:hover:text-white dark:active:text-white ${className}`}
      {...props}
    >
      <span className="material-symbols-outlined size-5 m-2">{icon}</span>
      {text ? <span className="m-2 mr-4">{text}</span> : null}
    </button>
  );
}

export default IconButton;
