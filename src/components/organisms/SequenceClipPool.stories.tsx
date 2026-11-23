import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { sampleFrameRate } from "@/fixtures/video";
import SequenceClipPool from "./SequenceClipPool";

const meta = {
  title: "Organisms/SequenceClipPool",
  component: SequenceClipPool,
  args: {
    ...sequenceStoryMedia,
    frameRate: sampleFrameRate,
    thumbnails: {},
    beginClipDrag: fn(),
    endClipDrag: fn(),
  },
} satisfies Meta<typeof SequenceClipPool>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedMedia: Story = {
  parameters: {
    docs: {
      description: {
        story: "Drag a clip to see its ID in Actions. This standalone pool has no drop target.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Harbor ambience", { exact: true })).toBeInTheDocument();
    await expect(canvas.getByText("Audio only", { exact: true })).toBeVisible();
    await expect(canvas.getByText("Video only", { exact: true })).toBeVisible();
    await expect(canvas.getByText("Audio and video", { exact: true })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { clips: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No clips available")).toBeVisible();
  },
};
