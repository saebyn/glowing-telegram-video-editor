import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { sampleFrameRate } from "@/fixtures/video";
import SequencePreviewPlaceholder from "./SequencePreviewPlaceholder";

const meta = {
  title: "Molecules/SequencePreviewPlaceholder",
  component: SequencePreviewPlaceholder,
  decorators: [
    (Story) => (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-slate-100">
        <Story />
      </div>
    ),
  ],
  args: {
    frameRate: sampleFrameRate,
    playheadFrame: 90,
    durationFrames: 360,
    playback: "paused",
  },
} satisfies Meta<typeof SequencePreviewPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paused: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Preview is not connected.")).toBeVisible();
    await expect(canvas.getByText("Paused · Sequence frame 90 of 360")).toBeVisible();
  },
};

export const PlayingForward: Story = {
  args: { playback: "forward" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Playing forward · Sequence frame 90 of 360")).toBeVisible();
  },
};

export const PlayingReverse: Story = {
  args: { playback: "reverse" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Playing reverse · Sequence frame 90 of 360")).toBeVisible();
  },
};
