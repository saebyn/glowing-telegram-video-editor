import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import { sampleFrameRate } from "@/fixtures/video";
import { snapFrame } from "@/utils/frames";
import SequenceToolbar, { type SequenceToolbarProps } from "./SequenceToolbar";

const meta = {
  title: "Organisms/SequenceToolbar",
  component: SequenceToolbar,
  decorators: [
    (Story) => (
      <div className="min-h-48 rounded bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Story />
      </div>
    ),
  ],
  args: {
    splitMode: false,
    transport: {
      frameRate: sampleFrameRate,
      durationFrames: 360,
      playheadFrame: 90,
      playback: "paused",
      seek: fn(),
      playForward: fn(),
      playReverse: fn(),
      pause: fn(),
    },
  },
  render: (args) => (
    <ToolbarExample
      key={`${args.splitMode}:${args.transport.playheadFrame}:${args.transport.playback}`}
      {...args}
    />
  ),
} satisfies Meta<typeof SequenceToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToolbarExample({ transport, ...args }: SequenceToolbarProps) {
  const [splitMode, setSplitMode] = useState(args.splitMode);
  const [playheadFrame, setPlayheadFrame] = useState(transport.playheadFrame);
  const [playback, setPlayback] = useState(transport.playback);
  return (
    <SequenceToolbar
      {...args}
      splitMode={splitMode}
      toggleSplitMode={
        args.toggleSplitMode &&
        (() => {
          args.toggleSplitMode?.();
          setSplitMode((active) => !active);
        })
      }
      transport={{
        ...transport,
        playheadFrame,
        playback,
        seek(frame) {
          transport.seek(frame);
          setPlayheadFrame(snapFrame(frame, transport.durationFrames));
          setPlayback("paused");
        },
        playForward() {
          transport.playForward();
          setPlayback("forward");
        },
        playReverse() {
          transport.playReverse();
          setPlayback("reverse");
        },
        pause() {
          transport.pause();
          setPlayback("paused");
        },
      }}
    />
  );
}

export const EditingControls: Story = {
  args: {
    splitAtPlayhead: fn(),
    toggleSplitMode: fn(),
    undo: fn(),
    deleteSelection: fn(),
    addTrack: fn(),
    renameTrack: {
      tracks: [
        { id: "picture", label: "Picture" },
        { id: "sound", label: "Sound" },
      ],
      onRename: fn(),
    },
    shorten: { durationFrames: 360, onShorten: fn((endFrame: number) => endFrame < 360) },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Transport controls report state without playing media. Edit buttons emit requests in Actions rather than editing a sequence.",
      },
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    const splitMode = canvas.getByRole("button", { name: "Split mode" });
    await userEvent.click(splitMode);
    await expect(args.toggleSplitMode).toHaveBeenCalledOnce();
    await expect(splitMode).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(splitMode);
    await expect(splitMode).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(canvas.getByRole("button", { name: "Rename track" }));
    const dialog = within(canvas.getByRole("dialog", { name: "Rename track" }));
    await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Track" }), "sound");
    const name = dialog.getByRole("textbox", { name: "Track name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Ambience");
    await userEvent.click(dialog.getByRole("button", { name: "Save name" }));
    await expect(args.renameTrack?.onRename).toHaveBeenCalledWith("sound", "Ambience");

    await userEvent.click(canvas.getByText("Sequence endpoint"));
    const shorten = canvas.getByRole("button", { name: "Shorten sequence" });
    await userEvent.click(shorten);
    await expect(args.shorten?.onShorten).toHaveBeenCalledWith(360);
    await expect(canvas.getByRole("alert")).toHaveTextContent("leaves every placement intact");
    const endpoint = canvas.getByRole("spinbutton", { name: "Sequence end (exclusive frame)" });
    await userEvent.clear(endpoint);
    await userEvent.type(endpoint, "300");
    await userEvent.click(shorten);
    await expect(args.shorten?.onShorten).toHaveBeenCalledWith(300);
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByText("Sequence endpoint"));
  },
};

export const ReadOnly: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: "Split" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(canvas.queryByRole("button", { name: "Add track" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await expect(args.transport.seek).toHaveBeenCalledWith(150);
    await expect(canvas.getByLabelText("Sequence playhead position")).toHaveTextContent(
      "Sequence frame 150",
    );
  },
};
