import { Fragment, type CSSProperties, type ReactNode, useId, useRef, useState } from "react";
import type { WorkspacePane } from "./WorkspacePaneToggles";

const paneLabels = { clipPool: "Clip pool", preview: "Preview", inspector: "Inspector" };
const minimumWidths = { clipPool: 192, preview: 224, inspector: 224 };
type Pane = keyof typeof paneLabels;
type Widths = Record<Pane, number>;

type Drag = {
  pointerId: number;
  x: number;
  widths: Widths;
  visibility: ReadonlySet<WorkspacePane>;
};

export default function SequenceWorkspace({
  clipPool,
  inspector,
  hiddenPanes,
}: {
  clipPool: ReactNode;
  inspector: ReactNode;
  hiddenPanes: ReadonlySet<WorkspacePane>;
}) {
  const id = useId();
  const elements = useRef<Record<Pane, HTMLElement | null>>({
    clipPool: null,
    preview: null,
    inspector: null,
  });
  const drag = useRef<Drag | null>(null);
  // Keep preferred widths by pane, independent of whether they render side by side.
  const [widths, setWidths] = useState<Widths>({ clipPool: 1, preview: 1.25, inspector: 0.75 });
  const workspacePanes = [
    { pane: "clipPool", className: "grid", content: clipPool },
    {
      pane: "preview",
      className:
        "flex min-h-40 flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-slate-100",
      content: (
        <>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-slate-300">Preview is not connected.</p>
        </>
      ),
    },
    {
      pane: "inspector",
      className: "rounded-lg bg-gray-50 p-4 wrap-anywhere dark:bg-gray-800",
      content: (
        <>
          <h2 className="mb-2 text-lg font-semibold">Inspector</h2>
          {inspector}
        </>
      ),
    },
  ] as const;
  const panes = workspacePanes.filter(({ pane }) => !hiddenPanes.has(pane));
  const total = panes.reduce((sum, { pane }) => sum + widths[pane], 0);
  const columns = panes
    .map(
      ({ pane }) => `minmax(${minimumWidths[pane]}px, ${(widths[pane] / total) * panes.length}fr)`,
    )
    .join(" 16px ");

  function measureWidths() {
    const measure = (pane: Pane) => elements.current[pane]?.getBoundingClientRect().width ?? 0;
    return {
      clipPool: measure("clipPool"),
      preview: measure("preview"),
      inspector: measure("inspector"),
    };
  }

  function resize(before: Pane, after: Pane, start: Widths, movement: number) {
    const delta = Math.max(
      minimumWidths[before] - start[before],
      Math.min(movement, start[after] - minimumWidths[after]),
    );
    // Translate pixels back to the same total weight for the visible panes.
    // Updating only visible weights keeps the hidden panes' shares unchanged.
    const pixels = panes.reduce((sum, { pane }) => sum + start[pane], 0);
    if (!pixels) return;
    setWidths((previous) => {
      const next = { ...previous };
      for (const { pane } of panes) {
        const change = pane === before ? delta : pane === after ? -delta : 0;
        next[pane] = ((start[pane] + change) / pixels) * total;
      }
      return next;
    });
  }

  if (panes.length === 0) return null;

  return (
    <div className="@container">
      <div
        className="grid grid-cols-1 gap-4 @min-[64rem]:grid-cols-(--workspace-columns) @min-[64rem]:gap-0"
        style={{ "--workspace-columns": columns } as CSSProperties}
      >
        {panes.map(({ pane, className, content }, index) => {
          const before = panes[index - 1]?.pane;
          return (
            <Fragment key={pane}>
              {before && (
                <div
                  key={`${before}:${pane}`}
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- This is a focusable, keyboard-adjustable splitter, not a thematic break.
                  role="separator"
                  aria-label={`Resize ${paneLabels[before]} and ${paneLabels[pane]}`}
                  aria-orientation="vertical"
                  aria-controls={`${id}-${before}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((100 * widths[before]) / total)}
                  tabIndex={0}
                  className="my-2 hidden min-w-0 touch-none cursor-col-resize border-x-[6px] border-y-0 border-transparent bg-slate-500 bg-clip-content hover:bg-blue-500 focus-visible:bg-blue-500 active:bg-blue-500 @min-[64rem]:block"
                  onPointerDown={(event) => {
                    if (event.button !== 0 || drag.current?.visibility === hiddenPanes) return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = {
                      pointerId: event.pointerId,
                      x: event.clientX,
                      widths: measureWidths(),
                      visibility: hiddenPanes,
                    };
                  }}
                  onPointerMove={(event) => {
                    const active = drag.current;
                    if (
                      active?.pointerId === event.pointerId &&
                      active.visibility === hiddenPanes
                    ) {
                      resize(before, pane, active.widths, event.clientX - active.x);
                    }
                  }}
                  onLostPointerCapture={(event) => {
                    if (drag.current?.pointerId === event.pointerId) drag.current = null;
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    if (drag.current?.visibility !== hiddenPanes) {
                      resize(before, pane, measureWidths(), event.key === "ArrowLeft" ? -16 : 16);
                    }
                  }}
                />
              )}
              <section
                ref={(element) => {
                  elements.current[pane] = element;
                }}
                id={`${id}-${pane}`}
                aria-label={paneLabels[pane]}
                className={`min-w-0 ${className}`}
              >
                {content}
              </section>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
