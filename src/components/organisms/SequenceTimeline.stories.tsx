import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { sampleFrameRate } from "@/fixtures/video";
import type { SequenceTrack } from "@/types";
import SequenceTimeline, { type SequenceTimelineProps } from "./SequenceTimeline";

const tracks: SequenceTrack[] = [
  {
    id: "picture",
    label: "Picture",
    placements: [
      {
        id: "opening",
        clipId: "harbor",
        sequenceStartFrame: 0,
        transitionIn: { id: "opening-fade", kind: "fade", durationFrames: 24 },
      },
      { id: "closing", clipId: "lighthouse", sequenceStartFrame: 240 },
    ],
  },
  {
    id: "sound",
    label: "Sound",
    locked: true,
    placements: [{ id: "bed", clipId: "ambience", sequenceStartFrame: 60 }],
  },
];

const meta = {
  title: "Organisms/SequenceTimeline",
  component: SequenceTimeline,
  decorators: [
    (Story) => (
      <div className="rounded bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    trimRanges: { control: false },
    fadePlacementIds: { control: false },
    dissolveDetails: { control: false },
  },
  args: {
    ...sequenceStoryMedia,
    frameRate: sampleFrameRate,
    durationFrames: 360,
    playheadFrame: 90,
    tracks,
    removableTrackIds: [],
    trimRanges: new Map(),
    fadePlacementIds: new Set(),
    selectedPlacementIds: [],
    dissolveDetails: new Map(),
    splitMode: false,
    onSeek: fn(),
    endClipDrag: fn(),
    selectTransition: fn(),
  },
  render: (args) => (
    <TimelineExample
      key={JSON.stringify([
        args.playheadFrame,
        args.selectedPlacementIds,
        args.selectedTransitionId,
      ])}
      {...args}
    />
  ),
} satisfies Meta<typeof SequenceTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

function TimelineExample(args: SequenceTimelineProps) {
  const [playheadFrame, setPlayheadFrame] = useState(args.playheadFrame);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState(args.selectedPlacementIds);
  const [selectedTransitionId, setSelectedTransitionId] = useState(args.selectedTransitionId);
  return (
    <SequenceTimeline
      {...args}
      playheadFrame={playheadFrame}
      selectedPlacementIds={selectedPlacementIds}
      selectedTransitionId={selectedTransitionId}
      onSeek={(frame) => {
        args.onSeek(frame);
        setPlayheadFrame(frame);
      }}
      selectTransition={(id) => {
        args.selectTransition(id);
        setSelectedTransitionId(id);
        setSelectedPlacementIds([]);
      }}
      activatePlacement={
        args.activatePlacement &&
        ((activation) => {
          args.activatePlacement?.(activation);
          const { placementId, toggle } = activation;
          setSelectedPlacementIds((current) =>
            !toggle
              ? [placementId]
              : current.includes(placementId)
                ? current.filter((id) => id !== placementId)
                : [...current, placementId],
          );
          setSelectedTransitionId(undefined);
        })
      }
      clearPlacementSelection={
        args.clearPlacementSelection &&
        (() => {
          args.clearPlacementSelection?.();
          setSelectedPlacementIds([]);
          setSelectedTransitionId(undefined);
        })
      }
    />
  );
}

export const LayeredSequence: Story = {
  args: {
    activatePlacement: fn(),
    clearPlacementSelection: fn(),
    selectedPlacementIds: ["closing"],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Inspect a picture track with a gap and a locked sound track that overlaps both picture placements. Click the opening fade indicator to inspect it, or the strip below it to select its placement. Drag empty track space, scroll horizontally, or use Shift+wheel to pan. Zoom and use the sequence playhead to navigate; Fit sequence restores the overview.",
      },
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    const lighthouse = await canvas.findByRole("button", { name: /Lighthouse/ });
    await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText("Locked", { exact: true })).toBeVisible();

    const fade = canvas.getByRole("button", { name: "Select entry fade: Harbor" });
    await userEvent.click(fade);
    await expect(args.selectTransition).toHaveBeenCalledWith("opening-fade");
    await expect(fade).toHaveAttribute("aria-pressed", "true");
    await expect(lighthouse).toHaveAttribute("aria-pressed", "false");

    const playhead = canvas.getByRole("slider", { name: "Sequence playhead" });
    playhead.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onSeek).toHaveBeenCalledWith(91);
    await expect(playhead).toHaveAttribute("aria-valuenow", "91");
  },
};

export const EmptySequence: Story = {
  args: { durationFrames: 0, playheadFrame: 0, tracks: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Sequence timeline" })).toBeVisible();
    await expect(canvas.queryByRole("group", { name: /^Track:/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Fit sequence" })).toBeDisabled();
  },
};
