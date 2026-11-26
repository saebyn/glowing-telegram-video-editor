import { useState } from "react";
import type { Sequence } from "@/types";

type HistoryOperation = "edit" | "undo" | "redo";

interface Proposal {
  operation: HistoryOperation;
  onAccept?: () => void;
}

interface History {
  current: Sequence;
  past: readonly Sequence[];
  future: readonly Sequence[];
  pending: WeakMap<Sequence, Proposal>;
}

export function useSequenceHistory(
  sequence: Sequence,
  emitEdit: (next: Sequence) => void,
  onReplace: () => void,
  canPropose: { readonly current: boolean },
) {
  const [history, setHistory] = useState<History>(() => ({
    current: sequence,
    past: [],
    future: [],
    pending: new WeakMap(),
  }));

  if (sequence !== history.current) {
    const { current, past, future, pending } = history;
    const accepted = pending.get(sequence);
    setHistory({
      current: sequence,
      past: accepted
        ? accepted.operation === "undo"
          ? past.slice(0, -1)
          : [...past, current]
        : [],
      future: !accepted
        ? []
        : accepted.operation === "undo"
          ? [...future, current]
          : accepted.operation === "redo"
            ? future.slice(0, -1)
            : [],
      // Retire sibling proposals even if Undo later revisits their base object.
      pending: new WeakMap(),
    });
    // Like the history update, this callback only adjusts session state during render.
    if (accepted) accepted.onAccept?.();
    else onReplace();
  }

  function propose(next: Sequence, operation: HistoryOperation, onAccept?: () => void) {
    if (!canPropose.current) return;
    // Register before notifying the host, without keeping the proposed sequence alive.
    history.pending.set(next, { operation, onAccept });
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
