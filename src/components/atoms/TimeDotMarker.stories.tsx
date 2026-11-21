import { TimelineProvider } from "@/context/TimelineContext";
import { TimeDotMarker } from "./TimeDotMarker";

export default {
  title: "Atoms/TimeDotMarker",
  component: TimeDotMarker,
  tags: ["atoms"],
  decorators: [
    (story: () => React.ReactNode) => (
      <TimelineProvider durationFrames={3600}>{story()}</TimelineProvider>
    ),
  ],
};

export const Default = {
  args: {
    sourceFrame: 600,
    className: "bg-red-500",
  },
};
