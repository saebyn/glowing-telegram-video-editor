import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { VideoSelectionPage } from "@saebyn/glowing-telegram-video-editor";
import "@saebyn/glowing-telegram-video-editor/custom-only.css";

const content = {
  sourceId: "example",
  title: "Source review",
  video_url: "/unused.m3u8",
  frameRate: { numerator: 30, denominator: 1 },
  durationFrames: 1200, // Enough for Clip Silences to select a clip.
  highlights: [],
  attentions: [],
  transcription_errors: [],
  silences: [],
  chat_history: [],
  transcript: [],
};

createRoot(document.querySelector("#app")).render(createElement(VideoSelectionPage, { content }));
