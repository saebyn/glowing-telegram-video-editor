import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { VideoClip } from "@/types";
import { convertFrameOffset, formatFrames, layoutSequence, snapFrame } from "@/utils/frames";

const MIN_INLINE_TRIM_WIDTH = 16; // two 8px handles

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
  const [trackWidth, setTrackWidth] = useState(0);
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
  const displayLayout = trimmingClip
    ? layoutSequence(
        clips.map((clip) => (clip.id === trimmingClip.original.id ? trimmingClip.draft : clip)),
        frameRate,
      )
    : layout;
  const narrowClips = layout.placements.filter(
    ({ durationFrames }) =>
      trackWidth > 0 &&
      layout.durationFrames > 0 &&
      (durationFrames / layout.durationFrames) * trackWidth < MIN_INLINE_TRIM_WIDTH,
  );
  const narrowClipIds = new Set(narrowClips.map(({ clip }) => clip.id));

  useEffect(() => {
    const track = timelineRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData("text/plain", index.toString());
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
    setIsDraggingOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
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

  const handleTimelineClick = (event: React.MouseEvent<HTMLElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!onSeek || !rect || rect.width <= 0) return;
    const x = event.clientX - rect.left;
    onSeek(
      snapFrame((x / rect.width) * displayLayout.durationFrames, displayLayout.durationFrames),
    );
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

  const renderTrimHandle = (clip: VideoClip, edge: TrimEdge, compact = false) => {
    const label = `Trim ${edge} point`;
    const side = edge === "in" ? "left-0" : "right-0";
    return (
      <button
        key={edge}
        type="button"
        className={
          compact
            ? "cursor-ew-resize rounded-sm bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
            : `absolute ${side} top-0 bottom-0 w-2 bg-blue-500 opacity-80 hover:opacity-100 focus-visible:opacity-100 cursor-ew-resize z-20 transition-opacity group-hover:opacity-100 border-0 p-0`
        }
        onMouseDown={(e) => handleTrimStart(e, clip, edge)}
        onKeyDown={(e) => handleTrimKeyDown(e, clip, edge)}
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
        title={`${label} (drag or use arrow keys)`}
      >
        {compact ? (
          label
        ) : (
          <div
            className={`absolute ${side} top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-sm`}
          />
        )}
      </button>
    );
  };

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

  const { placements, durationFrames: totalFrames } = displayLayout;
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
        className="relative bg-white dark:bg-gray-900 ring-2 ring-inset ring-gray-300 dark:ring-gray-600 rounded-md overflow-hidden"
        style={{ height }}
        onClick={handleTimelineClick}
      >
        {/* Time markers */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 flex items-center px-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">0:00</div>
          <div className="flex-1" />
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {formatFrames(totalFrames, frameRate)}
          </div>
        </div>

        {/* Clips container */}
        <div className="absolute top-6 left-0 right-0 bottom-0 flex items-center">
          {clips.length === 0 && (
            <div
              className={`flex-1 h-full border-2 border-dashed rounded flex items-center justify-center ${
                isDraggingOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 0)}
            >
              <span className="text-gray-400 dark:text-gray-500 text-sm">
                Drop clips here to add to timeline
              </span>
            </div>
          )}

          {placements.map(({ clip, durationFrames }, index) => (
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
              style={{
                width: `${toPercent(durationFrames)}%`,
              }}
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

                {/* Remove button */}
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
              </div>
            </div>
          ))}
        </div>

        {/* Playhead */}
        {totalFrames > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
            style={{
              left: `${toPercent(snapFrame(playheadFrame, totalFrames))}%`,
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-red-500" />
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
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
