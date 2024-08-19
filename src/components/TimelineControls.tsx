import Button from "./Button";
import { useLens } from "./TimelineContext";
import TimelineLegend from "./TimelineLegend";

export type TimelineControlsProps = {
  followPlayback: boolean;
  setFollowPlayback: (followPlayback: boolean) => void;
};

export default function TimelineControls({
  followPlayback,
  setFollowPlayback,
}: TimelineControlsProps) {
  const lens = useLens();

  const handleReset = () => {
    lens.reset();
  };

  const handleZoomIn = () => {
    lens.zoomIn();
  };

  const handleZoomOut = () => {
    lens.zoomOut();
  };

  return (
    <div
      className="mt-4 rounded bg-gray-200
              p-4 text-gray-800 dark:bg-gray-700 dark:text-gray-200
              "
    >
      <TimelineLegend />

      <Button onClick={handleZoomIn}>Zoom In</Button>
      <Button
        className="mx-2 rounded bg-gray-300 px-4 py-2 dark:bg-gray-400"
        onClick={handleZoomOut}
      >
        Zoom Out
      </Button>
      <Button
        className="mx-2 rounded bg-gray-300 px-4 py-2 dark:bg-gray-400"
        onClick={handleReset}
      >
        Reset
      </Button>

      <label className="flex items-center space-x-2 p-4">
        <input
          type="checkbox"
          checked={followPlayback}
          onChange={(e) => setFollowPlayback(e.target.checked)}
        />
        <span>Follow playback</span>
      </label>
    </div>
  );
}
