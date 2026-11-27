import { useLayoutEffect, useRef, useState } from "react";
import type { Sequence } from "@/types";

type HistoryOperation = "edit" | "undo" | "redo";

interface History {
  current: Sequence;
  past: readonly Sequence[];
  future: readonly Sequence[];
}

export function useSequenceHistory(
  initialSequence: Sequence,
  emitEdit: (next: Sequence) => void,
  canEdit: { readonly current: boolean },
  canRestore: (target: Sequence) => boolean,
) {
  const [history, setHistory] = useState<History>(() => ({
    current: initialSequence,
    past: [],
    future: [],
  }));
  // Actions can run several times before React publishes another render.
  const latest = useRef(history);
  const callbacks = useRef({ emitEdit, canRestore });
  const notifications = useRef<Array<() => void>>([]);
  useLayoutEffect(() => {
    callbacks.current = { emitEdit, canRestore };
  });

  function commit(operation: HistoryOperation, edit?: Sequence, onCommit?: () => void) {
    if (!canEdit.current) return;
    const { current, past, future } = latest.current;
    const next = operation === "undo" ? past.at(-1) : operation === "redo" ? future.at(-1) : edit;
    if (!next || next === current) return;
    if (operation !== "edit" && !callbacks.current.canRestore(next)) return;
    latest.current = {
      current: next,
      past: operation === "undo" ? past.slice(0, -1) : [...past, current],
      future:
        operation === "undo"
          ? [...future, current]
          : operation === "redo"
            ? future.slice(0, -1)
            : [],
    };
    setHistory(latest.current);
    onCommit?.();
    const notify = callbacks.current.emitEdit;
    const queue = notifications.current;
    queue.push(() => notify(next));
    // A listener can commit another edit before the current pair finishes.
    if (queue.length !== 1) return;
    try {
      for (const send of queue) send();
    } finally {
      queue.length = 0;
    }
  }

  return {
    sequence: history.current,
    getWorkingSequence: () => latest.current.current,
    commitEdit: (next: Sequence, onCommit?: () => void) => commit("edit", next, onCommit),
    undo: history.past.length ? () => commit("undo") : undefined,
    redo: history.future.length ? () => commit("redo") : undefined,
  };
}
