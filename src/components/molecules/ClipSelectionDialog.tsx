import Button from "@/components/atoms/Button";
import IconButton from "@/components/atoms/IconButton";

import TimeLink from "@/components/atoms/TimeLink";
import type { VideoClip } from "@/types";
import { formatSeconds } from "@/utils/duration";
import { framesToSeconds } from "@/utils/frames";
import DEFAULT_KEYFRAME_SRC from "../../assets/logo.svg";

interface Props {
  clips: VideoClip[];
  show: boolean;
  onClear: () => void;
  onExport: () => void;
  onRemove: (id: string) => void;
  onReorder: (clips: VideoClip[]) => void;
  onCopyInPoint: (id: string) => void;
  onCopyOutPoint: (id: string) => void;
  onSeekToFrame: (sourceFrame: number) => void;
}

export default function ClipSelectionDialog({
  clips,
  show,
  onClear,
  onExport,
  onRemove,
  onReorder,
  onCopyInPoint,
  onCopyOutPoint,
  onSeekToFrame,
}: Props) {
  if (!show) {
    return null;
  }

  const totalSeconds = clips.reduce((total, clip) => {
    const { sourceInFrame, sourceOutFrame, sourceFrameRate } = clip;
    return Number.isSafeInteger(sourceInFrame) &&
      Number.isSafeInteger(sourceOutFrame) &&
      sourceInFrame >= 0 &&
      sourceOutFrame > sourceInFrame
      ? total + framesToSeconds(sourceOutFrame - sourceInFrame, sourceFrameRate)
      : total;
  }, 0);

  const handleRemove = (id: string) => {
    onRemove(id);
  };

  const handleReorder = (index: number, direction: "up" | "down") => {
    const newClips = [...clips];
    const [removed] = newClips.splice(index, 1);
    newClips.splice(direction === "up" ? index - 1 : index + 1, 0, removed);
    onReorder(newClips);
  };

  return (
    <div className="fixed  shadow-lg p-4 flex flex-col space-y-4 right-8 bottom-2 z-50 bg-white text-gray-800 dark:bg-gray-800 dark:text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="mr-4">
          <h2 className="text-xl font-bold">Selected Clips</h2>
          <output className="block font-semibold tabular-nums">
            Total duration: {formatSeconds(totalSeconds)}
          </output>
        </div>
        <Button variant="danger" onClick={onClear}>
          Clear
        </Button>

        <IconButton variant="primary" onClick={onExport} icon="file_export" text="Export" />
      </div>
      <ul className="flex-grow overflow-y-auto space-y-1">
        {clips.map((clip, index) => (
          <li
            key={clip.id}
            className="border border-gray-200 rounded-sm p-1 flex items-center animate-highlight-new"
          >
            <img
              src={clip.keyframeSrc || DEFAULT_KEYFRAME_SRC}
              width={48}
              height={45}
              alt={`Keyframe for clip ${clip.id}`}
              className="mr-2"
            />
            <div className="flex-grow">
              <TimeLink
                onClick={onSeekToFrame}
                frame={clip.sourceInFrame}
                frameRate={clip.sourceFrameRate}
              />
              -{" "}
              <TimeLink
                onClick={onSeekToFrame}
                frame={clip.sourceOutFrame}
                frameRate={clip.sourceFrameRate}
              />
            </div>
            <div className="flex space-x-1">
              <IconButton
                onClick={() => handleRemove(clip.id)}
                icon="close"
                title="Remove"
                variant="danger"
              />
              <IconButton
                onClick={() => handleReorder(index, "up")}
                disabled={index === 0}
                icon="move_up"
                title="Move up"
              />
              <IconButton
                onClick={() => handleReorder(index, "down")}
                disabled={index === clips.length - 1}
                icon="move_down"
                title="Move down"
              />
              <IconButton
                onClick={() => onCopyInPoint(clip.id)}
                icon="line_start_square"
                title="Copy in point from playhead"
                variant="secondary"
              />
              <IconButton
                onClick={() => onCopyOutPoint(clip.id)}
                icon="line_end_square"
                title="Copy out point from playhead"
                variant="secondary"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
