import type { Meta } from "@storybook/react-vite";
import { action } from "storybook/actions";
import { useArgs } from "storybook/preview-api";
import { sampleFrameRate } from "@/fixtures/video";
import VideoPlayerProgressBar from "./VideoPlayerProgressBar";

const meta: Meta<typeof VideoPlayerProgressBar> = {
  title: "Atoms/VideoPlayerProgressBar",
  component: VideoPlayerProgressBar,
  tags: ["atoms"],
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <VideoPlayerProgressBar
        {...args}
        onSeek={(playheadFrame) => {
          updateArgs({ playheadFrame });
          args.onSeek(playheadFrame);
        }}
      />
    );
  },
};

export default meta;

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
