import { TimelineProvider } from "context/TimelineContext";
import { TimeDotMarker } from "./TimeDotMarker";

export default {
  title: "Atoms/TimeDotMarker",
  component: TimeDotMarker,
  tags: ["atoms"],
  decorators: [
    (story: () => React.ReactNode) => (
      <TimelineProvider contentLength={1000 * 60 * 60}>
        {story()}
      </TimelineProvider>
    ),
  ],
};

export const Default = {
  args: {
    timestampMilliseconds: 60000,
    className: "bg-red-500",
  },
};
