import { Timeline, type TimelineEditor } from "@keplar-404/react-timeline-editor";
import { type CSSProperties, type DragEvent, useLayoutEffect, useRef, useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { Sequence, VideoClip } from "@/types";
import {
  formatFrames,
  framesToSeconds,
  getProjectFrameCount,
  secondsToFrame,
} from "@/utils/frames";
import { getPlacementSourceRange } from "@/utils/sequence";

const RULER_HEIGHT = 32;
const ROW_HEIGHT = 40;
const TICK_COUNT = 4;
const EFFECTS = {
  placement: { id: "placement", name: "Placement" },
  transition: { id: "transition", name: "Transition" },
};

type SequenceTimelineProps = {
  sequence: Sequence;
  clips: readonly VideoClip[];
  titles: Record<string, string>;
  onClipDrop?: (clipId: string, sequenceFrame: number) => void;
  selectedPlacementId?: string;
  onPlacementSelect?: (id: string) => void;
};

export default function SequenceTimeline({
  sequence: { durationFrames, tracks },
  clips,
  titles,
  onClipDrop,
  selectedPlacementId,
  onPlacementSelect,
}: SequenceTimelineProps) {
  const frameRate = useProjectFrameRate();
  const surface = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const scale = framesToSeconds(Math.max(1, durationFrames), frameRate) / TICK_COUNT;
  const scaleWidth = Math.max(1, width / TICK_COUNT);

  useLayoutEffect(() => {
    const node = surface.current!;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows: TimelineEditor["editorData"] = [];
  const rowLabels: string[] = [];
  const itemLabels = new Map<string, string>();

  function action(id: string, effectId: string, start: number, duration: number, label: string) {
    itemLabels.set(id, label);
    return {
      id,
      effectId,
      start: framesToSeconds(start, frameRate),
      end: framesToSeconds(start + duration, frameRate),
      movable: false,
      flexible: false,
    };
  }

  for (const track of tracks) {
    const entryTransitions = track.placements.flatMap((placement) =>
      placement.entryTransitionFrames
        ? [
            action(
              `${placement.id}:entry`,
              "transition",
              placement.sequenceStartFrame,
              placement.entryTransitionFrames,
              "Fade in",
            ),
          ]
        : [],
    );
    if (entryTransitions.length) {
      rows.push({ id: `${track.id}:transitions`, actions: entryTransitions });
      rowLabels.push("Transitions");
    }

    rows.push({
      id: track.id,
      actions: track.placements.flatMap((placement) => {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip) return [];
        const range = getPlacementSourceRange(clip, placement);
        return action(
          placement.id,
          "placement",
          placement.sequenceStartFrame,
          getProjectFrameCount(range, frameRate),
          titles[clip.id] ?? `Clip ${clip.id}`,
        );
      }),
    });
    rowLabels.push(track.label);
  }

  function isOverTrack(event: DragEvent<HTMLDivElement>) {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    // Drop is enabled only for one authored track. Its transition row isn't a target.
    const trackBottom = RULER_HEIGHT + rows.length * ROW_HEIGHT;
    return onClipDrop && y >= trackBottom - ROW_HEIGHT && y < trackBottom;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onClipDrop || !isOverTrack(event)) return;
    const data = event.dataTransfer.getData("application/json");
    if (!data) return;
    event.preventDefault();
    let clipIds: unknown;
    try {
      clipIds = JSON.parse(data);
    } catch {
      return;
    }
    if (!Array.isArray(clipIds) || clipIds.length !== 1 || typeof clipIds[0] !== "string") return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    onClipDrop(clipIds[0], secondsToFrame((x / scaleWidth) * scale, frameRate));
  }

  return (
    <section aria-label="Sequence timeline">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Sequence timeline</h2>
        <span className="text-sm tabular-nums">
          Duration: {formatFrames(durationFrames, frameRate)}
        </span>
      </div>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-md bg-slate-800 text-slate-100">
        <div className="text-sm">
          <div className="flex items-center px-3 font-semibold" style={{ height: RULER_HEIGHT }}>
            Tracks
          </div>
          {rows.map(({ id }, index) => (
            <div
              key={id}
              className="flex items-center border-t border-slate-600 px-3"
              style={{ height: ROW_HEIGHT }}
            >
              {rowLabels[index]}
            </div>
          ))}
        </div>
        <div
          ref={surface}
          className="gtve-sequence-timeline"
          style={{ "--gtve-ruler-height": `${RULER_HEIGHT}px` } as CSSProperties}
          onDragOver={(event) => {
            if (isOverTrack(event) && event.dataTransfer.types.includes("application/json")) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={handleDrop}
        >
          <Timeline
            editorData={rows}
            effects={EFFECTS}
            style={{ width: "100%", height: RULER_HEIGHT + rows.length * ROW_HEIGHT }}
            startLeft={0}
            scale={scale}
            scaleWidth={scaleWidth}
            scaleSplitCount={4}
            minScaleCount={TICK_COUNT}
            maxScaleCount={TICK_COUNT}
            rowHeight={ROW_HEIGHT}
            getScaleRender={(seconds) => {
              const frame = secondsToFrame(seconds, frameRate);
              const label = formatFrames(frame, frameRate);
              // The widget centers labels on ticks; keep the final one inside the ruler.
              return frame === durationFrames ? (
                <span className="inline-block -translate-x-1/2">{label}</span>
              ) : (
                label
              );
            }}
            disableDrag
            autoReRender={false}
            onClickTimeArea={() => false}
            getActionRender={({ id, effectId }) => {
              const label = itemLabels.get(id);
              const classes = `absolute inset-x-px inset-y-1 flex items-center overflow-hidden whitespace-nowrap rounded border px-2 text-xs font-medium ${
                effectId === "transition"
                  ? "border-amber-300 bg-amber-950 text-amber-100"
                  : "border-sky-400 bg-sky-950 text-sky-100"
              }`;
              return effectId === "placement" && onPlacementSelect ? (
                <button
                  type="button"
                  title={label}
                  aria-pressed={selectedPlacementId === id}
                  onClick={() => onPlacementSelect(id)}
                  className={`${classes} cursor-pointer aria-pressed:bg-sky-800`}
                >
                  {label}
                </button>
              ) : (
                <div title={label} className={classes}>
                  {label}
                </div>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
