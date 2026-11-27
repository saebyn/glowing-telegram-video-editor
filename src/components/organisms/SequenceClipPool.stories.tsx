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

const sourceBoundClip = {
  id: "at-source-end",
  sourceId: "source",
  sourceFrameRate: sampleFrameRate,
  sourceInFrame: 100,
  sourceOutFrame: 129,
  sourceDurationFrames: 129,
};

export const KnownSourceEnd: Story = {
  args: {
    clips: [sourceBoundClip, { ...sourceBoundClip, id: "past-source-end", sourceOutFrame: 130 }],
    titles: { "at-source-end": "At source end", "past-source-end": "Past source end" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("At source end", { exact: true })).toBeInTheDocument();
    await expect(canvas.queryByText("Past source end", { exact: true })).not.toBeInTheDocument();
  },
};
