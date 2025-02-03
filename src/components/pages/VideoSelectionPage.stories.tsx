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

      length: 1000 * 60 * 60,
      highlights: [
        {
          timestamp: 0,
          timestamp_end: 1000 * 60 * 60,
          description: "This is a test highlight",
          reasoning: "This is the reasoning for the highlight",
        },
      ],
      attentions: [],
      transcription_errors: [],
      silences: [],
      chat_history: [],
      transcript: [],
    },
  },
};
