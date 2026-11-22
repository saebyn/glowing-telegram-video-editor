import { useState } from "react";
import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { SequenceSource, VideoClip } from "@/types";
import { getProjectFrameCount } from "@/utils/frames";
import { mediaKindLabels } from "./mediaKindLabels";

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
   * Optional source metadata for labeling clips with a known media kind.
   */
  sources?: readonly Pick<SequenceSource, "id" | "mediaKind">[];
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
  sources,
  clipWidth = "150px",
  clipHeight = "115px",
  onClipSelect,
  onTitleUpdate,
  onDragStart,
  showCheckboxes = false,
}: ProjectClipPoolProps) {
  const frameRate = useProjectFrameRate();
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const mediaKinds = sources && new Map(sources.map(({ id, mediaKind }) => [id, mediaKind]));

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

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, clipId: string) => {
    // If the dragged clip is not selected, only drag that clip
    // If the dragged clip is selected, drag all selected clips
    const clipsToDrag = selectedClips.has(clipId) ? Array.from(selectedClips) : [clipId];

    event.dataTransfer.setData("application/json", JSON.stringify(clipsToDrag));
    event.dataTransfer.effectAllowed = "copy";
    onDragStart?.(clipsToDrag);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Clip Pool</h2>
      <div className="flex flex-wrap gap-4">
        {clips.map((clip) => {
          const mediaKind = mediaKinds?.get(clip.sourceId);
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
                durationFrames={getProjectFrameCount(clip, frameRate)}
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
              {mediaKind && (
                <p className="mt-1 text-center text-xs font-medium text-slate-700 dark:text-slate-200">
                  {mediaKindLabels[mediaKind]}
                </p>
              )}
            </div>
          );
        })}
        {clips.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 italic">No clips available</div>
        )}
      </div>
    </div>
  );
}
