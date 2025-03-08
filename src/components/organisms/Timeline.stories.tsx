import { TimelineProvider } from "@/context/TimelineContext";
import Timeline from "./Timeline";

import { action } from "@storybook/addon-actions";

export default {
  title: "Organisms/Timeline",
  component: Timeline,
  tags: ["organisms"],

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
    content: {
      chat_history: [],
      silences: [],
      highlights: [
        {
          timestamp: 0,
          timestamp_end: 1000 * 60 * 60,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
      ],
      attentions: [
        {
          timestamp: 10 * 60 * 60,
          timestamp_end: 20 * 60 * 60,
          category: "Test Category",
          description: "This is a test attention",
          reasoning: "This is the reasoning for the attention",
        },
      ],
      transcription_errors: [],
    },
    playheadTime: 0,
    onSeekToTime: action("onSeekToTime"),
  },
};
