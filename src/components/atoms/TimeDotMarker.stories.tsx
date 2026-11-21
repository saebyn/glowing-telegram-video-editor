import { TimelineProvider } from "@/context/TimelineContext";
import { sampleFrameRate } from "@/fixtures/video";
import { secondsToFrame } from "@/utils/frames";
import { TimeDotMarker } from "./TimeDotMarker";

const durationFrames = secondsToFrame(60 * 60, sampleFrameRate);

export default {
  title: "Atoms/TimeDotMarker",
  component: TimeDotMarker,
  tags: ["atoms"],
  decorators: [
    (story: () => React.ReactNode) => (
      <TimelineProvider durationFrames={durationFrames}>{story()}</TimelineProvider>
    ),
  ],
};

export const Default = {
  args: {
    sourceFrame: secondsToFrame(60, sampleFrameRate),
    className: "bg-red-500",
  },
};
