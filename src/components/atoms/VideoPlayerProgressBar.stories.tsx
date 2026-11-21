import { action } from "storybook/actions";
import { sampleFrameRate } from "@/fixtures/video";
import VideoPlayerProgressBar from "./VideoPlayerProgressBar";

export default {
  title: "Atoms/VideoPlayerProgressBar",
  component: VideoPlayerProgressBar,
  tags: ["atoms"],
};

export const Default = {
  args: {
    playheadFrame: 0,
    onSeek: action("Seek to Frame"),
    durationFrames: 6000,
    frameRate: sampleFrameRate,
  },
};

export const Progress = {
  args: {
    playheadFrame: 4200,
    onSeek: action("Seek to Frame"),
    durationFrames: 6000,
    frameRate: sampleFrameRate,
  },
};
