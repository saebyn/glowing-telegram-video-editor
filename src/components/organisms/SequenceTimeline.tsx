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

  const items = new Map<
    string,
    { label: string; entryFadePercent: number; revealFadePercent: number }
  >();
  const rows: TimelineEditor["editorData"] = tracks.map((track) => ({
    id: track.id,
    actions: track.placements.flatMap((placement) => {
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return [];
      const duration = getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate);
      if (duration <= 0) return [];
      items.set(placement.id, {
        label: titles[clip.id] ?? `Clip ${clip.id}`,
        entryFadePercent: (100 * (placement.entryTransitionFrames ?? 0)) / duration,
        revealFadePercent: (100 * (placement.revealTransitionFrames ?? 0)) / duration,
      });
      return {
        id: placement.id,
        effectId: "placement",
        start: framesToSeconds(placement.sequenceStartFrame, frameRate),
        end: framesToSeconds(placement.sequenceStartFrame + duration, frameRate),
        movable: false,
        flexible: false,
      };
    }),
  }));

  function isOverTrack(event: DragEvent<HTMLDivElement>) {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    // Drop is enabled only for one authored track.
    return onClipDrop && y >= RULER_HEIGHT && y < RULER_HEIGHT + ROW_HEIGHT;
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
          {tracks.map(({ id, label }) => (
            <div
              key={id}
              className="flex items-center border-t border-slate-600 px-3"
              style={{ height: ROW_HEIGHT }}
            >
              {label}
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
            getActionRender={({ id }) => {
              const item = items.get(id);
              if (!item) return null;
              const { label, entryFadePercent, revealFadePercent } = item;
              const classes = `absolute inset-0 flex overflow-hidden rounded border border-sky-400 bg-sky-950 px-2 text-xs font-medium whitespace-nowrap text-sky-100 ${
                entryFadePercent > 0 || revealFadePercent > 0 ? "items-end pb-0.5" : "items-center"
              }`;
              const fadeClasses =
                "pointer-events-none absolute top-0 h-3 overflow-hidden bg-amber-300 indent-1 text-[9px]/3 font-semibold whitespace-nowrap text-amber-950";
              return (
                <div className="absolute inset-x-px inset-y-1 overflow-hidden rounded">
                  {onPlacementSelect ? (
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
                  )}
                  {entryFadePercent > 0 && (
                    <span
                      className={`${fadeClasses} left-0 rounded-r`}
                      style={{ width: `${Math.min(100, entryFadePercent)}%` }}
                    >
                      Fade in
                    </span>
                  )}
                  {revealFadePercent > 0 && (
                    <span
                      className={`${fadeClasses} right-0 rounded-l`}
                      style={{ width: `${Math.min(100, revealFadePercent)}%` }}
                    >
                      Fade out
                    </span>
                  )}
                </div>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
