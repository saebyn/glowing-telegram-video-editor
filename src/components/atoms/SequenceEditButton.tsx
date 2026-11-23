import type { PropsWithChildren } from "react";

export interface SequenceEditButtonProps {
  onClick?: () => void;
}

export function SequenceEditButton({
  onClick,
  children,
}: PropsWithChildren<SequenceEditButtonProps>) {
  return (
    <button
      type="button"
      // Preserve focus when an accepted Undo or Redo makes its action unavailable.
      aria-disabled={!onClick}
      tabIndex={onClick ? undefined : -1}
      className="rounded border px-3 py-1 text-sm aria-disabled:opacity-60"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
