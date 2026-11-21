import { action } from "storybook/actions";
import { TimelineProvider } from "@/context/TimelineContext";
import { sampleFrameRate } from "@/fixtures/video";
import Timeline from "./Timeline";

export default {
  title: "Organisms/Timeline",
  component: Timeline,
  tags: ["organisms"],

  decorators: [
    (story: () => React.ReactNode) => (
      <TimelineProvider durationFrames={21_600}>{story()}</TimelineProvider>
    ),
  ],
};

export const Default = {
  args: {
    content: {
      sourceId: "sample-source",
      title: "Sample source",
      video_url: "",
      frameRate: sampleFrameRate,
      durationFrames: 21_600,
      chat_history: [],
      silences: [],
      highlights: [
        {
          sourceFrame: 0,
          sourceOutFrame: 5400,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
      ],
      attentions: [
        {
          sourceFrame: 7200,
          sourceOutFrame: 14_400,
          category: "Test Category",
          description: "This is a test attention",
          reasoning: "This is the reasoning for the attention",
        },
      ],
      transcription_errors: [],
    },
    playheadFrame: 0,
    onSeekToFrame: action("onSeekToFrame"),
    onItemSelect: action("onItemSelect"),
  },
};
