import Button from "components/atoms/Button";
import IconButton from "components/atoms/IconButton";

import DEFAULT_KEYFRAME_SRC from "assets/logo.svg";

type Cut = {
  id: string;
  start: number;
  end: number;
  keyframeSrc?: string;
};

interface Props {
  cuts: Cut[];
  onClose: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onReorder: (cuts: Cut[]) => void;
}

export default function SelectedCutsDialog({
  cuts,
  onClose,
  onClear,
  onRemove,
  onReorder,
}: Props) {
  const handleRemove = (id: string) => {
    onRemove(id);
  };

  const handleReorder = (index: number, direction: "up" | "down") => {
    const newCuts = [...cuts];
    const [removed] = newCuts.splice(index, 1);
    newCuts.splice(direction === "up" ? index - 1 : index + 1, 0, removed);
    onReorder(newCuts);
  };

  return (
    <div className="fixed w-96 bg-white shadow-lg p-4 flex flex-col space-y-4 right-0 bottom-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Selected Cuts</h2>
        <Button onClick={onClose}>Close</Button>
        <Button
          className="bg-red-500
        dark:bg-red-600 hover:bg-red-600 active:bg-red-700 dark:hover:bg-red-700 dark:active:bg-red-800 hover:text-white active:text-white dark:hover:text-white dark:active:text-white
        "
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
      <ul className="flex-grow overflow-y-auto space-y-1">
        {cuts.map((cut, index) => (
          <li
            key={cut.id}
            className="border border-gray-200 rounded p-1 flex items-center"
          >
            <img
              src={cut.keyframeSrc || DEFAULT_KEYFRAME_SRC}
              width={48}
              height={45}
              alt={`Keyframe for cut ${cut.id}`}
              className="mr-2"
            />
            <div className="flex-grow">
              Cut {cut.id}: {cut.start}s - {cut.end}s
            </div>
            <div className="flex space-x-1">
              <IconButton
                onClick={() => handleRemove(cut.id)}
                icon="close"
                title="Remove"
              />
              <IconButton
                onClick={() => handleReorder(index, "up")}
                disabled={index === 0}
                icon="arrow_upward"
                title="Move up"
              />
              <IconButton
                onClick={() => handleReorder(index, "down")}
                disabled={index === cuts.length - 1}
                icon="arrow_downward"
                title="Move down"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
