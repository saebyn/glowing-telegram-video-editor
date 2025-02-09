import Button from "components/atoms/Button";
import IconButton from "components/atoms/IconButton";

import DEFAULT_KEYFRAME_SRC from "assets/logo.svg";
import { formatMs } from "utils/duration";

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
}

export default function ClipSelectionDialog({
  clips,
  show,
  onClear,
  onExport,
  onRemove,
  onReorder,
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
    <div className="fixed w-96 bg-white shadow-lg p-4 flex flex-col space-y-4 right-0 bottom-0 z-50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Selected Clips</h2>
        <Button
          className="bg-red-500
        dark:bg-red-600 hover:bg-red-600 active:bg-red-700 dark:hover:bg-red-700 dark:active:bg-red-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white
        "
          onClick={onClear}
        >
          Clear
        </Button>

        <IconButton
          className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 active:bg-blue-700 dark:hover:bg-blue-700 dark:active:bg-blue-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white"
          onClick={onExport}
          icon="file_export"
          text="Export"
        />
      </div>
      <ul className="flex-grow overflow-y-auto space-y-1">
        {clips.map((clip, index) => (
          <li
            key={clip.id}
            className="border border-gray-200 rounded p-1 flex items-center"
          >
            <img
              src={clip.keyframeSrc || DEFAULT_KEYFRAME_SRC}
              width={48}
              height={45}
              alt={`Keyframe for clip ${clip.id}`}
              className="mr-2"
            />
            <div className="flex-grow">
              {formatMs(clip.start)} - {formatMs(clip.end)}
            </div>
            <div className="flex space-x-1">
              <IconButton
                onClick={() => handleRemove(clip.id)}
                icon="close"
                title="Remove"
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
