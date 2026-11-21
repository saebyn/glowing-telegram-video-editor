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
      attentions: [{ sourceFrame: 120, sourceOutFrame: 300, description: "Check the audio" }],
      transcription_errors: [{ sourceFrame: 175, description: "Unclear phrase" }],
      silences: [{ sourceFrame: 800, sourceOutFrame: 1100 }],
      chat_history: [{ sourceFrame: 192, username: "viewer", message: "Nice!" }],
      transcript: [],
    },
    onExport: action("Export"),
  },
};

const longSource = {
  ...Default.args.content,
  sourceId: "long-source",
  title: "Four-hour source review fixture",
  frameRate: { numerator: 60, denominator: 1 },
  video_url: "/source-review-fixture.m3u8",
  durationFrames: 864_000,
  highlights: [{ sourceFrame: 780_001, sourceOutFrame: 850_003, description: "Closing highlight" }],
  attentions: [{ sourceFrame: 782_000, sourceOutFrame: 827_000, description: "Review the outro" }],
  silences: [],
  transcription_errors: [],
  chat_history: [],
};

export const SparseLongSource = {
  args: { ...Default.args, content: longSource },
};

export const DenseChat = {
  args: {
    ...Default.args,
    content: {
      ...longSource,
      sourceId: "dense-chat",
      chat_history: [
        { sourceFrame: 18_000, username: "Early viewer", message: "Hello!" },
        ...Array.from({ length: 5_000 }, (_, index) => ({
          sourceFrame: 431_000 + index * 2,
          username: `Viewer ${index + 1}`,
          message: "Sample chat message",
        })),
      ],
    },
  },
};
