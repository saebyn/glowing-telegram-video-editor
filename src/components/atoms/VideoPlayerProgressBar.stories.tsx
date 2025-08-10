import { action } from "@storybook/addon-actions";
import VideoPlayerProgressBar from "./VideoPlayerProgressBar";

export default {
  title: "Atoms/VideoPlayerProgressBar",
  component: VideoPlayerProgressBar,
  tags: ["atoms"],
};

export const Default = {
  args: {
    progress: 0,
    seekToPercent: action("Seek to Percent"),
    duration: 100,
  },
};

export const Progress = {
  args: {
    progress: 70,
    seekToPercent: action("Seek to Percent"),
    duration: 100,
  },
};
