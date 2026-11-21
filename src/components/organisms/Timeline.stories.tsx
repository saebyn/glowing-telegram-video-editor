import { action } from "storybook/actions";
import { TimelineProvider } from "@/context/TimelineContext";
import { sampleFrameRate } from "@/fixtures/video";
import { secondsToFrame } from "@/utils/frames";
import Timeline from "./Timeline";

const durationFrames = secondsToFrame(60 * 60, sampleFrameRate);

export default {
  title: "Organisms/Timeline",
  component: Timeline,
  tags: ["organisms"],

  decorators: [
    (story: () => React.ReactNode) => (
      <TimelineProvider durationFrames={durationFrames}>{story()}</TimelineProvider>
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
      durationFrames,
      chat_history: [],
      silences: [],
      highlights: [
        {
          sourceFrame: 0,
          sourceOutFrame: durationFrames,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
      ],
      attentions: [
        {
          sourceFrame: secondsToFrame(36, sampleFrameRate),
          sourceOutFrame: secondsToFrame(72, sampleFrameRate),
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
