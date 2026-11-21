import { Timeline, type TimelineState } from "@keplar-404/react-timeline-editor";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { VideoClip } from "@/types";
import {
  convertFrameOffset,
  formatFrames,
  framesToSeconds,
  layoutSequence,
  secondsToFrame,
  snapFrame,
} from "@/utils/frames";

const MIN_INLINE_TRIM_WIDTH = 16; // two 8px handles
const MIN_INLINE_REMOVE_WIDTH = 36; // clip body and room to click the remove button
const SCALE_COUNT = 4;
const RULER_HEIGHT = 32;
const EFFECTS = { clip: { id: "clip", name: "Clip placement" } };

export interface ProjectClipTimelineProps {
  /**
   * Clips arranged on the timeline
   */
  clips: VideoClip[];
  /**
   * Thumbnail URL for each clip
   */
  thumbnails: Record<string, string>;
  /**
   * Keyframe URLs for animation on hover
   */
  keyframes: Record<string, string[]>;
  /**
   * Custom titles for clips
   */
  titles: Record<string, string>;
  /**
   * Current playhead position in sequence frames
   */
  playheadFrame?: number;
  /**
   * Height of the timeline
   */
  height?: string;
  /**
   * Callback when clips are reordered
   */
  onClipsReorder?: (clips: VideoClip[]) => void;
  /**
   * Callback when a clip is removed
   */
  onClipRemove?: (clipId: string) => void;
  /**
   * Callback when a clip title is updated
   */
  onTitleUpdate?: (clipId: string, newTitle: string) => void;
  /**
   * Callback when the user seeks to a sequence frame
   */
  onSeek?: (sequenceFrame: number) => void;
  /**
   * Callback when clips are dropped from the pool, with a clip insertion index
   */
  onClipsAdd?: (clipIds: string[], insertionIndex: number) => void;
  /**
   * Callback when a clip is trimmed, preserving native source frame positions
   */
  onClipTrim?: (clipId: string, sourceInFrame: number, sourceOutFrame: number) => void;
  /**
   * Optional render prop called at each clip boundary.
   * Receives the id of the left clip and the id of the right clip.
   * When provided, a transition bar row is rendered above the clip scrubber;
   * each call result is centered exactly on the seam between two clips.
   */
  renderTransition?: (leftClipId: string, rightClipId: string) => React.ReactNode;
}

type TrimEdge = "in" | "out";
type TrimFocus = { clipId: string; edge: TrimEdge };

function TrimHandle({
  clipId,
  edge,
  compact,
  pendingFocus,
  onMouseDown,
  onKeyDown,
}: {
  clipId: string;
  edge: TrimEdge;
  compact: boolean;
  pendingFocus: React.RefObject<TrimFocus | null>;
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>;
}) {
  const bindButton = useCallback(
    (button: HTMLButtonElement | null) => {
      if (!button) return;
      const document = button.ownerDocument;
      // React detaches the old handle before attaching its replacement.
      if (pendingFocus.current?.clipId === clipId && pendingFocus.current.edge === edge) {
        pendingFocus.current = null;
        if (document.activeElement === document.body) button.focus();
      }
      return () => {
        if (document.activeElement === button) pendingFocus.current = { clipId, edge };
      };
    },
    [clipId, edge, pendingFocus],
  );
  const label = `Trim ${edge} point`;
  const side = edge === "in" ? "left-0" : "right-0";
  return (
    <button
      ref={bindButton}
      type="button"
      className={
        compact
          ? "cursor-ew-resize rounded-sm bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          : `absolute ${side} top-0 bottom-0 w-2 bg-blue-500 opacity-80 hover:opacity-100 focus-visible:opacity-100 cursor-ew-resize z-20 transition-opacity group-hover:opacity-100 border-0 p-0`
      }
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      title={`${label} (drag or use arrow keys)`}
    >
      {compact ? (
        label
      ) : (
        <div className={`absolute ${side} top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-sm`} />
      )}
    </button>
  );
}

function trimClip(clip: VideoClip, edge: TrimEdge, offsetFrames: number): VideoClip {
  if (edge === "in") {
    return {
      ...clip,
      sourceInFrame: Math.max(
        0,
        Math.min(clip.sourceOutFrame - 1, clip.sourceInFrame + offsetFrames),
      ),
    };
  }
  return {
    ...clip,
    sourceOutFrame: Math.min(
      clip.sourceDurationFrames ?? Number.MAX_SAFE_INTEGER,
      Math.max(clip.sourceInFrame + 1, clip.sourceOutFrame + offsetFrames),
    ),
  };
}

export default function ProjectClipTimeline({
  clips,
  thumbnails,
  keyframes,
  titles,
  playheadFrame = 0,
  height = "200px",
  onClipsReorder,
  onClipRemove,
  onTitleUpdate,
  onSeek,
  onClipsAdd,
  onClipTrim,
  renderTransition,
}: ProjectClipTimelineProps) {
  const frameRate = useProjectFrameRate();
  const timelineRef = useRef<HTMLElement>(null);
  const widgetRef = useRef<TimelineState>(null);
  const suppressTrimClickRef = useRef(false);
  const pendingTrimFocus = useRef<TrimFocus | null>(null);
  const [trackSize, setTrackSize] = useState({ width: 0, height: 0 });
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [trimmingClip, setTrimmingClip] = useState<{
    original: VideoClip;
    draft: VideoClip;
    edge: TrimEdge;
    initialX: number;
    projectFramesPerPixel: number;
  } | null>(null);

  const layout = useMemo(() => layoutSequence(clips, frameRate), [clips, frameRate]);
  const displayLayout = useMemo(
    () =>
      trimmingClip
        ? layoutSequence(
            clips.map((clip) => (clip.id === trimmingClip.original.id ? trimmingClip.draft : clip)),
            frameRate,
          )
        : layout,
    [clips, frameRate, layout, trimmingClip],
  );
  const { placements, durationFrames: totalFrames } = displayLayout;
  const { rows, placementIndices } = useMemo(() => {
    const placementIndices = new Map<string, number>();
    const actions = placements.map(({ clip, sequenceStartFrame, durationFrames }, index) => {
      placementIndices.set(clip.id, index);
      return {
        id: clip.id,
        effectId: "clip",
        start: framesToSeconds(sequenceStartFrame, frameRate),
        end: framesToSeconds(sequenceStartFrame + durationFrames, frameRate),
        movable: false,
        flexible: false,
      };
    });
    return { rows: [{ id: "sequence", actions }], placementIndices };
  }, [placements, frameRate]);
  const narrowClips = layout.placements.filter(
    ({ durationFrames }) =>
      trackSize.width > 0 &&
      layout.durationFrames > 0 &&
      (durationFrames / layout.durationFrames) * trackSize.width <
        (onClipRemove ? MIN_INLINE_REMOVE_WIDTH : MIN_INLINE_TRIM_WIDTH),
  );
  const narrowClipIds = new Set(narrowClips.map(({ clip }) => clip.id));

  // A removed clip has no replacement handle. Don't carry its focus into a later commit.
  useLayoutEffect(() => {
    pendingTrimFocus.current = null;
  });

  useLayoutEffect(() => {
    const track = timelineRef.current;
    if (!track) return;
    const measure = () => {
      const { width, height } = track.getBoundingClientRect();
      setTrackSize({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    widgetRef.current?.setTime(framesToSeconds(snapFrame(playheadFrame, totalFrames), frameRate));
  }, [playheadFrame, totalFrames, frameRate]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData("text/plain", index.toString());
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/json")
      ? "copy"
      : "move";
    setDragOverIndex(index);
    setIsDraggingOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>, dropIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverIndex(null);
    setIsDraggingOver(false);

    // Check if this is a drop from the clip pool
    try {
      const jsonData = event.dataTransfer.getData("application/json");
      if (jsonData) {
        const clipIds = JSON.parse(jsonData) as string[];
        onClipsAdd?.(clipIds, dropIndex);
        return;
      }
    } catch {
      // Not JSON data, continue with internal reordering
    }

    const dragIndexStr = event.dataTransfer.getData("text/plain");
    const dragIndex = Number.parseInt(dragIndexStr, 10);

    if (
      !Number.isInteger(dragIndex) ||
      dragIndex < 0 ||
      dragIndex >= clips.length ||
      dragIndex === dropIndex
    ) {
      return;
    }

    const newClips = [...clips];
    const [draggedClip] = newClips.splice(dragIndex, 1);

    // Adjust drop index if dragging from before the drop position
    const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newClips.splice(adjustedDropIndex, 0, draggedClip);

    onClipsReorder?.(newClips);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
    setIsDraggingOver(false);
  };

  const seek = (seconds: number, event: React.MouseEvent<HTMLElement>) => {
    // Releasing a trim can click the row if the handle moved out from under the pointer.
    if (event.detail > 0 && suppressTrimClickRef.current) return;
    onSeek?.(snapFrame(secondsToFrame(seconds, frameRate), totalFrames));
  };

  const handleRemoveClip = (event: React.MouseEvent, clipId: string) => {
    event.stopPropagation();
    onClipRemove?.(clipId);
  };

  const handleTrimStart = (event: React.MouseEvent, clip: VideoClip, edge: TrimEdge) => {
    event.stopPropagation();
    event.preventDefault();
    const width = timelineRef.current?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    suppressTrimClickRef.current = true;
    setTrimmingClip({
      original: clip,
      draft: clip,
      edge,
      initialX: event.clientX,
      projectFramesPerPixel: layout.durationFrames / width,
    });
  };

  const handleTrimMove = useCallback(
    (event: MouseEvent) => {
      setTrimmingClip((trim) => {
        if (!trim) return trim;
        const deltaX = event.clientX - trim.initialX;
        const projectOffset = Math.round(deltaX * trim.projectFramesPerPixel);
        const sourceOffset = convertFrameOffset(
          projectOffset,
          frameRate,
          trim.original.sourceFrameRate,
        );
        return { ...trim, draft: trimClip(trim.original, trim.edge, sourceOffset) };
      });
    },
    [frameRate],
  );

  const handleTrimEnd = useCallback(() => {
    if (!trimmingClip) return;

    const { draft } = trimmingClip;
    onClipTrim?.(draft.id, draft.sourceInFrame, draft.sourceOutFrame);

    setTrimmingClip(null);
  }, [trimmingClip, onClipTrim]);

  const handleTrimKeyDown = (event: React.KeyboardEvent, clip: VideoClip, edge: TrimEdge) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const trimmed = trimClip(clip, edge, event.key === "ArrowLeft" ? -1 : 1);
    onClipTrim?.(trimmed.id, trimmed.sourceInFrame, trimmed.sourceOutFrame);
  };

  const renderTrimHandle = (clip: VideoClip, edge: TrimEdge, compact = false) => (
    <TrimHandle
      clipId={clip.id}
      edge={edge}
      compact={compact}
      pendingFocus={pendingTrimFocus}
      onMouseDown={(e) => handleTrimStart(e, clip, edge)}
      onKeyDown={(e) => handleTrimKeyDown(e, clip, edge)}
    />
  );

  // Handle trim mouse events
  useEffect(() => {
    if (!trimmingClip) return;

    const handleMouseMove = (e: MouseEvent) => handleTrimMove(e);
    const handleMouseUp = () => handleTrimEnd();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [trimmingClip, handleTrimMove, handleTrimEnd]);

  const toPercent = (frames: number) => (totalFrames > 0 ? (frames / totalFrames) * 100 : 0);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Timeline</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Total: {formatFrames(totalFrames, frameRate)}
        </span>
      </div>

      {/* Transition bar row — same flex layout as the clip row so widths align */}
      {renderTransition && clips.length > 1 && (
        <div className="flex mb-1">
          {placements.map(({ clip, durationFrames }, index) => {
            const isLast = index === placements.length - 1;
            return (
              <div
                key={clip.id}
                className="relative flex-shrink-0"
                style={{ width: `${toPercent(durationFrames)}%` }}
              >
                {!isLast && (
                  /* Anchor at the right edge, centered on the seam */
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    {renderTransition(clip.id, placements[index + 1]!.clip.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section
        ref={timelineRef}
        aria-label="Sequence timeline"
        className="gtve-sequence-timeline relative rounded-md overflow-hidden"
        style={{ height, "--gtve-ruler-height": `${RULER_HEIGHT}px` } as React.CSSProperties}
        onPointerDownCapture={() => {
          suppressTrimClickRef.current = false;
        }}
        onDragOver={
          clips.length === 0
            ? (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setIsDraggingOver(true);
              }
            : undefined
        }
        onDragLeave={clips.length === 0 ? handleDragLeave : undefined}
        onDrop={clips.length === 0 ? (event) => handleDrop(event, 0) : undefined}
      >
        <Timeline
          ref={widgetRef}
          editorData={rows}
          effects={EFFECTS}
          style={{ width: "100%", height: "100%" }}
          startLeft={0}
          scale={framesToSeconds(Math.max(1, totalFrames), frameRate) / SCALE_COUNT}
          scaleWidth={trackSize.width / SCALE_COUNT || 1}
          scaleSplitCount={1}
          minScaleCount={SCALE_COUNT}
          maxScaleCount={SCALE_COUNT}
          rowHeight={Math.max(1, Math.floor(trackSize.height - RULER_HEIGHT))}
          getScaleRender={(seconds) =>
            totalFrames > 0 ? formatFrames(secondsToFrame(seconds, frameRate), frameRate) : null
          }
          disableDrag
          autoReRender={false}
          hideCursor={totalFrames === 0}
          onClickTimeArea={(seconds, event) => {
            seek(seconds, event);
            return false;
          }}
          onClickRow={(event, { time }) => {
            if (!(event.target instanceof Element && event.target.closest("button"))) {
              seek(time, event);
            }
          }}
          getActionRender={(action) => {
            const index = placementIndices.get(action.id);
            if (index === undefined) return null;
            const { clip, durationFrames } = placements[index];
            return (
              <div
                key={clip.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragLeave={handleDragLeave}
                onMouseEnter={() => setHoveredClipId(clip.id)}
                onMouseLeave={() => setHoveredClipId(null)}
                className={`group relative flex-shrink-0 h-full cursor-grab active:cursor-grabbing transition-all ${
                  dragOverIndex === index ? "ring-2 ring-inset ring-blue-500" : ""
                }`}
              >
                <div
                  className={`relative h-full ${narrowClipIds.has(clip.id) ? "overflow-hidden" : ""}`}
                >
                  {!narrowClipIds.has(clip.id) && renderTrimHandle(clip, "in")}

                  <ProjectClipPreview
                    id={clip.id}
                    thumbnailUrl={thumbnails[clip.id] || clip.keyframeSrc || ""}
                    keyframeUrls={keyframes[clip.id] || []}
                    title={titles[clip.id]}
                    durationFrames={durationFrames}
                    width="100%"
                    height="100%"
                    onTitleUpdate={onTitleUpdate}
                    showCheckbox={false}
                    forceShowOverlay={
                      hoveredClipId === clip.id || trimmingClip?.original.id === clip.id
                    }
                  />

                  {!narrowClipIds.has(clip.id) && renderTrimHandle(clip, "out")}

                  {!narrowClipIds.has(clip.id) && onClipRemove && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveClip(e, clip.id)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-80 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 group-hover:opacity-100"
                      aria-label="Remove clip"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <title>Remove</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          }}
        />
        {clips.length === 0 && (
          <div
            className={`gtve-sequence-empty pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center rounded border-2 border-dashed text-sm text-gray-400 ${
              isDraggingOver ? "border-blue-400 bg-blue-500/15" : "border-gray-600"
            }`}
          >
            Drop clips here to add to timeline
          </div>
        )}
      </section>
      {narrowClips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-900 dark:text-gray-100">
          {narrowClips.map(({ clip }) => {
            const title = titles[clip.id] || `Clip ${clip.id}`;
            return (
              <fieldset
                key={clip.id}
                aria-label={`Trim ${title}`}
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-sm border border-gray-300 p-2 dark:border-gray-600"
              >
                <span>{title}</span>
                {renderTrimHandle(clip, "in", true)}
                {renderTrimHandle(clip, "out", true)}
                {onClipRemove && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveClip(e, clip.id)}
                    className="rounded-sm bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                  >
                    Remove clip
                  </button>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
