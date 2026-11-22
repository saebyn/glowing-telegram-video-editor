import { useState } from "react";
import type { Sequence } from "@/types";

type HistoryOperation = "edit" | "undo" | "redo";

interface History {
  current: Sequence;
  past: readonly Sequence[];
  future: readonly Sequence[];
  pending?: { sequence: Sequence; operation: HistoryOperation };
}

export function useSequenceHistory(sequence: Sequence, emitEdit: (next: Sequence) => void) {
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
  }

  function propose(next: Sequence, operation: HistoryOperation) {
    setHistory({ ...history, pending: { sequence: next, operation } });
    emitEdit(next);
  }

  const previous = history.past.at(-1);
  const next = history.future.at(-1);
  return {
    commitEdit: (next: Sequence) => propose(next, "edit"),
    undo: previous ? () => propose(previous, "undo") : undefined,
    redo: next ? () => propose(next, "redo") : undefined,
  };
}
