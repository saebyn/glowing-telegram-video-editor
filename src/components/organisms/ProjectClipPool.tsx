import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import type { VideoClip } from "@/types";
import { useState } from "react";

export interface ProjectClipPoolProps {
  /**
   * Available clips that can be added to the timeline
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
   * Width of each clip preview
   */
  clipWidth?: string;
  /**
   * Height of each clip preview
   */
  clipHeight?: string;
  /**
   * Callback when a clip is selected
   */
  onClipSelect?: (clipId: string, selected: boolean) => void;
  /**
   * Callback when a clip title is updated
   */
  onTitleUpdate?: (clipId: string, newTitle: string) => void;
  /**
   * Callback when clips are dragged to add to timeline
   */
  onDragStart?: (clipIds: string[]) => void;
  /**
   * Show selection checkboxes
   */
  showCheckboxes?: boolean;
}

export default function ProjectClipPool({
  clips,
  thumbnails,
  keyframes,
  titles,
  clipWidth = "150px",
  clipHeight = "115px",
  onClipSelect,
  onTitleUpdate,
  onDragStart,
  showCheckboxes = false,
}: ProjectClipPoolProps) {
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());

  const handleClipSelect = (clipId: string, selected: boolean) => {
    const newSelected = new Set(selectedClips);
    if (selected) {
      newSelected.add(clipId);
    } else {
      newSelected.delete(clipId);
    }
    setSelectedClips(newSelected);
    onClipSelect?.(clipId, selected);
  };

  const handleTitleUpdate = (clipId: string, newTitle: string) => {
    onTitleUpdate?.(clipId, newTitle);
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    clipId: string,
  ) => {
    // If the dragged clip is not selected, only drag that clip
    // If the dragged clip is selected, drag all selected clips
    const clipsToDrag = selectedClips.has(clipId)
      ? Array.from(selectedClips)
      : [clipId];

    event.dataTransfer.setData("application/json", JSON.stringify(clipsToDrag));
    event.dataTransfer.effectAllowed = "copy";
    onDragStart?.(clipsToDrag);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Clip Pool
      </h2>
      <div className="flex flex-wrap gap-4">
        {clips.map((clip) => {
          const durationSeconds = (clip.end - clip.start) / 1000;

          return (
            <div
              key={clip.id}
              draggable
              onDragStart={(e) => handleDragStart(e, clip.id)}
              className="cursor-grab active:cursor-grabbing"
            >
              <ProjectClipPreview
                id={clip.id}
                thumbnailUrl={thumbnails[clip.id] || clip.keyframeSrc || ""}
                keyframeUrls={keyframes[clip.id] || []}
                title={titles[clip.id]}
                durationSeconds={durationSeconds}
                width={clipWidth}
                height={clipHeight}
                onTitleUpdate={handleTitleUpdate}
                {...(showCheckboxes
                  ? {
                      showCheckbox: true,
                      onSelect: handleClipSelect,
                    }
                  : { showCheckbox: false })}
              />
            </div>
          );
        })}
        {clips.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 italic">
            No clips available
          </div>
        )}
      </div>
    </div>
  );
}
