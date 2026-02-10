import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import type { VideoClip } from "@/types";
import { formatMs } from "@/utils/duration";

const MIN_CLIP_DURATION_MS = 1000;

export interface ProjectClipTimelineProps {
  /**
   * Clips arranged on the timeline
   */
  clips: VideoClip[];
  /**
   * Total duration of the timeline in milliseconds
   */
  duration: number;
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
   * Current playhead position in milliseconds
   */
  playheadPosition?: number;
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
   * Callback when user seeks to a time
   */
  onSeek?: (milliseconds: number) => void;
  /**
   * Callback when clips are dropped from pool
   */
  onClipsAdd?: (clipIds: string[], position: number) => void;
  /**
   * Callback when a clip is trimmed
   */
  onClipTrim?: (clipId: string, newStart: number, newEnd: number) => void;
}

export default function ProjectClipTimeline({
  clips,
  duration,
  thumbnails,
  keyframes,
  titles,
  playheadPosition = 0,
  height = "200px",
  onClipsReorder,
  onClipRemove,
  onTitleUpdate,
  onSeek,
  onClipsAdd,
  onClipTrim,
}: ProjectClipTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [trimmingClip, setTrimmingClip] = useState<{
    clipId: string;
    edge: "start" | "end";
    initialX: number;
    originalStart: number;
    originalEnd: number;
    tempStart: number;
    tempEnd: number;
  } | null>(null);

  // Calculate total duration of all clips
  const totalClipDuration = useMemo(() => {
    return clips.reduce((total, clip) => total + (clip.end - clip.start), 0);
  }, [clips]);

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.dataTransfer.setData("text/plain", index.toString());
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
    setIsDraggingOver(true);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    dropIndex: number,
  ) => {
    event.preventDefault();
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

    if (Number.isNaN(dragIndex) || dragIndex === dropIndex) {
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

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * totalClipDuration;

    onSeek(Math.max(0, Math.min(totalClipDuration, time)));
  };

  const handleRemoveClip = (event: React.MouseEvent, clipId: string) => {
    event.stopPropagation();
    onClipRemove?.(clipId);
  };

  const handleTrimStart = (
    event: React.MouseEvent,
    clip: VideoClip,
    edge: "start" | "end",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setTrimmingClip({
      clipId: clip.id,
      edge,
      initialX: event.clientX,
      originalStart: clip.start,
      originalEnd: clip.end,
      tempStart: clip.start,
      tempEnd: clip.end,
    });
  };

  const handleTrimMove = useCallback(
    (event: MouseEvent) => {
      if (!trimmingClip || !timelineRef.current) return;

      // Calculate total duration of all clips
      const currentTotalDuration = clips.reduce(
        (sum, c) => sum + (c.end - c.start),
        0,
      );

      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = event.clientX - trimmingClip.initialX;
      const timePerPixel = currentTotalDuration / rect.width;
      const deltaTime = deltaX * timePerPixel;

      const clip = clips.find((c) => c.id === trimmingClip.clipId);
      if (!clip) return;

      let newStart = trimmingClip.originalStart;
      let newEnd = trimmingClip.originalEnd;

      if (trimmingClip.edge === "start") {
        newStart = Math.max(
          0,
          Math.min(
            trimmingClip.originalStart + deltaTime,
            trimmingClip.originalEnd - MIN_CLIP_DURATION_MS,
          ),
        );
      } else {
        newEnd = Math.max(
          trimmingClip.originalStart + MIN_CLIP_DURATION_MS,
          trimmingClip.originalEnd + deltaTime,
        );
      }

      // Update temp values for visual feedback
      setTrimmingClip({
        ...trimmingClip,
        tempStart: newStart,
        tempEnd: newEnd,
      });
    },
    [trimmingClip, clips],
  );

  const handleTrimEnd = useCallback(() => {
    if (!trimmingClip) return;

    if (onClipTrim) {
      onClipTrim(
        trimmingClip.clipId,
        trimmingClip.tempStart,
        trimmingClip.tempEnd,
      );
    }

    setTrimmingClip(null);
  }, [trimmingClip, onClipTrim]);

  const handleTrimKeyDown = (
    event: React.KeyboardEvent,
    clip: VideoClip,
    edge: "start" | "end",
  ) => {
    // Use arrow keys to trim, Enter to confirm
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Enter"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Enter") {
      // No-op for Enter on trim handle (clips are always "confirmed")
      return;
    }

    // Arrow keys adjust the clip by 100ms increments
    const adjustmentMs = 100;
    const adjustment = event.key === "ArrowLeft" ? -adjustmentMs : adjustmentMs;

    let newStart = clip.start;
    let newEnd = clip.end;

    if (edge === "start") {
      newStart = Math.min(
        clip.end - MIN_CLIP_DURATION_MS,
        clip.start + adjustment,
      );
      newStart = Math.max(0, newStart);
    } else {
      newEnd = Math.max(
        clip.start + MIN_CLIP_DURATION_MS,
        clip.end + adjustment,
      );
    }

    // Notify trim callback
    if (onClipTrim) {
      onClipTrim(clip.id, newStart, newEnd);
    }
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

  // Calculate cumulative positions for clips
  let cumulativeTime = 0;
  const clipPositions = clips.map((clip) => {
    // Use temp trim values if this clip is being trimmed
    const displayClip =
      trimmingClip && trimmingClip.clipId === clip.id
        ? { ...clip, start: trimmingClip.tempStart, end: trimmingClip.tempEnd }
        : clip;

    const start = cumulativeTime;
    const clipDuration = displayClip.end - displayClip.start;
    cumulativeTime += clipDuration;
    return { clip: displayClip, start, duration: clipDuration };
  });

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Timeline
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Total: {formatMs(totalClipDuration)}
        </span>
      </div>

      <div
        ref={timelineRef}
        className="relative bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden"
        style={{ height }}
        onClick={handleTimelineClick}
      >
        {/* Time markers */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 flex items-center px-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">0:00</div>
          <div className="flex-1" />
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {formatMs(totalClipDuration)}
          </div>
        </div>

        {/* Clips container */}
        <div className="absolute top-6 left-0 right-0 bottom-0 flex items-center p-2 gap-2">
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

          {clipPositions.map(
            ({ clip, start, duration: clipDuration }, index) => {
              const widthPercent = (clipDuration / totalClipDuration) * 100;
              const durationSeconds = clipDuration / 1000;

              return (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragLeave={handleDragLeave}
                  className={`group relative flex-shrink-0 h-full cursor-grab active:cursor-grabbing transition-all ${
                    dragOverIndex === index
                      ? "border-l-4 border-blue-500 pl-1"
                      : ""
                  }`}
                  style={{
                    width: `${widthPercent}%`,
                    minWidth: "100px",
                  }}
                >
                  <div className="relative h-full">
                    {/* Start trim handle */}
                    <button
                      type="button"
                      className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500 opacity-80 hover:opacity-100 focus-visible:opacity-100 cursor-ew-resize z-20 transition-opacity group-hover:opacity-100 border-0 p-0"
                      onMouseDown={(e) => handleTrimStart(e, clip, "start")}
                      onKeyDown={(e) => handleTrimKeyDown(e, clip, "start")}
                      aria-label="Trim start of clip"
                      title="Trim start (use arrow keys to adjust)"
                    >
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r" />
                    </button>

                    <ProjectClipPreview
                      id={clip.id}
                      thumbnailUrl={
                        thumbnails[clip.id] || clip.keyframeSrc || ""
                      }
                      keyframeUrls={keyframes[clip.id] || []}
                      title={titles[clip.id]}
                      durationSeconds={durationSeconds}
                      width="100%"
                      height="100%"
                      onTitleUpdate={onTitleUpdate}
                      showCheckbox={false}
                    />

                    {/* End trim handle */}
                    <button
                      type="button"
                      className="absolute right-0 top-0 bottom-0 w-2 bg-blue-500 opacity-80 hover:opacity-100 focus-visible:opacity-100 cursor-ew-resize z-20 transition-opacity group-hover:opacity-100 border-0 p-0"
                      onMouseDown={(e) => handleTrimStart(e, clip, "end")}
                      onKeyDown={(e) => handleTrimKeyDown(e, clip, "end")}
                      aria-label="Trim end of clip"
                      title="Trim end (use arrow keys to adjust)"
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-l" />
                    </button>

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
              );
            },
          )}
        </div>

        {/* Playhead */}
        {playheadPosition !== undefined && totalClipDuration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
            style={{
              left: `${(playheadPosition / totalClipDuration) * 100}%`,
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
