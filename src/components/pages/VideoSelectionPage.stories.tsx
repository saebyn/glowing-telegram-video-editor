import { action } from "@storybook/addon-actions";
import VideoSelectionPage from "./VideoSelectionPage";

export default {
  title: "Pages/VideoSelectionPage",
  component: VideoSelectionPage,
  tags: ["pages"],
};

export const Default = {
  args: {
    content: {
      title: "Test Video",
      video_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      // 10 minutes, 34 seconds, in milliseconds
      length: 634000,
      highlights: [
        {
          timestamp: 0,
          timestamp_end: 10000,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
        {
          timestamp: 20000,
          timestamp_end: 30000,
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
