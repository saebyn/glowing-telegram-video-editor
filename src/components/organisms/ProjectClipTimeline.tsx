import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import type { VideoClip } from "@/types";
import { formatMs } from "@/utils/duration";
import { useRef, useState } from "react";

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
}: ProjectClipTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
    const time = percentage * duration;

    onSeek(Math.max(0, Math.min(duration, time)));
  };

  const handleRemoveClip = (event: React.MouseEvent, clipId: string) => {
    event.stopPropagation();
    onClipRemove?.(clipId);
  };

  // Calculate cumulative positions for clips
  let cumulativeTime = 0;
  const clipPositions = clips.map((clip) => {
    const start = cumulativeTime;
    const clipDuration = clip.end - clip.start;
    cumulativeTime += clipDuration;
    return { clip, start, duration: clipDuration };
  });

  const totalClipDuration = cumulativeTime;
  const scale = duration > 0 ? 100 / duration : 0;

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
            {formatMs(duration)}
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
                  className={`relative flex-shrink-0 h-full cursor-grab active:cursor-grabbing transition-all ${
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
                      onTitleUpdate={onTitleUpdate || (() => {})}
                      showCheckbox={false}
                    />

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveClip(e, clip.id)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
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
        {playheadPosition !== undefined && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
            style={{
              left: `${(playheadPosition / duration) * 100}%`,
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
