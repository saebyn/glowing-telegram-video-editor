import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import SequencePreview from "@/components/molecules/SequencePreview";
import { sampleFrameRate } from "@/fixtures/video";
import SequenceWorkspace from "./SequenceWorkspace";

const meta = {
  title: "Organisms/SequenceWorkspace",
  component: SequenceWorkspace,
  decorators: [
    (Story) => (
      <div className="rounded bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    clipPool: { control: false },
    preview: { control: false },
    inspector: { control: false },
  },
  args: {
    clipPool: <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">Clip pool slot</div>,
    preview: (
      <SequencePreview
        frameRate={sampleFrameRate}
        playheadFrame={90}
        durationFrames={360}
        playback="paused"
      />
    ),
    inspector: <p>Inspector slot</p>,
  },
} satisfies Meta<typeof SequenceWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreePanes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Below 64rem of workspace width, the panes stack. In a wider canvas, drag a separator or focus it and press Left or Right Arrow to resize adjacent panes.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: "Clip pool" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Preview" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Inspector" })).toBeVisible();
  },
};

export const Stacked: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: "Preview" })).toBeVisible();
    await expect(canvas.queryByRole("separator")).not.toBeInTheDocument();
  },
};

export const WithoutInspector: Story = {
  args: { inspector: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: "Preview" })).toBeVisible();
    await expect(canvas.queryByRole("region", { name: "Inspector" })).not.toBeInTheDocument();
  },
};
