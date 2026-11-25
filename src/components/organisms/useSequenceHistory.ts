import { useState } from "react";
import type { Sequence } from "@/types";

type HistoryOperation = "edit" | "undo" | "redo";

interface History {
  current: Sequence;
  past: readonly Sequence[];
  future: readonly Sequence[];
  pending?: { sequence: Sequence; operation: HistoryOperation; onAccept?: () => void };
}

export function useSequenceHistory(
  sequence: Sequence,
  emitEdit: (next: Sequence) => void,
  onReplace: () => void,
) {
  const [history, setHistory] = useState<History>({ current: sequence, past: [], future: [] });

  if (sequence !== history.current) {
    const { current, past, future, pending } = history;
    // Feeding back the proposed object acknowledges the edit; anything else replaces the sequence.
    const accepted = pending?.sequence === sequence;
    setHistory({
      current: sequence,
      past: accepted ? (pending.operation === "undo" ? past.slice(0, -1) : [...past, current]) : [],
      future: !accepted
        ? []
        : pending.operation === "undo"
          ? [...future, current]
          : pending.operation === "redo"
            ? future.slice(0, -1)
            : [],
    });
    // Like the history update, this callback only adjusts session state during render.
    if (accepted) pending.onAccept?.();
    else onReplace();
  }

  function propose(next: Sequence, operation: HistoryOperation, onAccept?: () => void) {
    setHistory({ ...history, pending: { sequence: next, operation, onAccept } });
    emitEdit(next);
  }

  const previous = history.past.at(-1);
  const next = history.future.at(-1);
  return {
    commitEdit: (next: Sequence, onAccept?: () => void) => propose(next, "edit", onAccept),
    undo: previous ? () => propose(previous, "undo") : undefined,
    redo: next ? () => propose(next, "redo") : undefined,
  };
}
