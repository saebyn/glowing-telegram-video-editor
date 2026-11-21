import { action } from "storybook/actions";
import VideoSelectionPage from "./VideoSelectionPage";

export default {
  title: "Pages/VideoSelectionPage",
  component: VideoSelectionPage,
  tags: ["pages"],
};

export const Default = {
  args: {
    content: {
      sourceId: "sample-source",
      frameRate: { numerator: 24, denominator: 1 },
      title: "Test Video",
      video_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      durationFrames: 15_216, // 10 minutes, 34 seconds
      highlights: [
        {
          sourceFrame: 0,
          sourceOutFrame: 240,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
        {
          sourceFrame: 480,
          sourceOutFrame: 720,
          description: "This is another test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
      ],
      attentions: [],
      transcription_errors: [],
      silences: [],
      chat_history: [],
      transcript: [],
    },
    onExport: action("Export"),
  },
};
