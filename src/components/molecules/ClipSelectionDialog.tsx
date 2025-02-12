import Button from "components/atoms/Button";
import IconButton from "components/atoms/IconButton";

import TimeLink from "components/atoms/TimeLink";
import DEFAULT_KEYFRAME_SRC from "../../assets/logo.svg";

export type VideoClip = {
  id: string;
  /**
   * Start time in milliseconds
   */
  start: number;
  /**
   * End time in milliseconds
   */
  end: number;
  keyframeSrc?: string;
};

interface Props {
  clips: VideoClip[];
  show: boolean;
  onClear: () => void;
  onExport: () => void;
  onRemove: (id: string) => void;
  onReorder: (clips: VideoClip[]) => void;
  onCopyStartTime: (id: string) => void;
  onCopyEndTime: (id: string) => void;
  onSeekToTime: (milliseconds: number) => void;
}

export default function ClipSelectionDialog({
  clips,
  show,
  onClear,
  onExport,
  onRemove,
  onReorder,
  onCopyStartTime,
  onCopyEndTime,
  onSeekToTime,
}: Props) {
  if (!show) {
    return null;
  }

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
        <h2 className="text-xl font-bold">Selected Clips</h2>
        <Button variant="danger" onClick={onClear}>
          Clear
        </Button>

        <IconButton
          variant="primary"
          onClick={onExport}
          icon="file_export"
          text="Export"
        />
      </div>
      <ul className="flex-grow overflow-y-auto space-y-1">
        {clips.map((clip, index) => (
          <li
            key={clip.id}
            className="border border-gray-200 rounded p-1 flex items-center animate-highlight-new"
          >
            <img
              src={clip.keyframeSrc || DEFAULT_KEYFRAME_SRC}
              width={48}
              height={45}
              alt={`Keyframe for clip ${clip.id}`}
              className="mr-2"
            />
            <div className="flex-grow">
              <TimeLink onClick={onSeekToTime} milliseconds={clip.start} />-{" "}
              <TimeLink onClick={onSeekToTime} milliseconds={clip.end} />
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
                onClick={() => onCopyStartTime(clip.id)}
                icon="line_start_square"
                title="Copy start time from playhead"
                variant="secondary"
              />
              <IconButton
                onClick={() => onCopyEndTime(clip.id)}
                icon="line_end_square"
                title="Copy end time from playhead"
                variant="secondary"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
