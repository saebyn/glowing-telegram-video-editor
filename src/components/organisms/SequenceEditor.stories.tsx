import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import harborThumbnail from "@/fixtures/sequence-harbor.svg?no-inline";
import lighthouseThumbnail from "@/fixtures/sequence-lighthouse.svg?no-inline";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import type { SequenceTrack } from "@/types";
import SequenceEditor, { type SequenceEditorProps } from "./SequenceEditor";

type EditingHostArgs = SequenceEditorProps & { acceptEdits?: boolean };

const meta = {
  title: "Organisms/SequenceEditor",
  component: SequenceEditor,
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
  argTypes: {
    // Accept nested fixture URL args as well as edits in the Controls panel.
    sequence: { control: "object", type: { name: "object", value: {} } },
    sources: { control: "object", type: { name: "array", value: { name: "object", value: {} } } },
    acceptEdits: { control: "boolean", name: "Accept edits" },
  },
  args: {
    acceptEdits: true,
    clips: [
      {
        id: "harbor",
        sourceId: "harbor-recording",
        sourceFrameRate: sampleFrameRate,
        sourceDurationFrames: 1_000,
        sourceInFrame: 114,
        sourceOutFrame: 234,
        keyframeSrc: harborThumbnail,
      },
      {
        id: "lighthouse",
        sourceId: "lighthouse-recording",
        sourceFrameRate: sampleFrameRate,
        sourceDurationFrames: 1_000,
        sourceInFrame: 501,
        sourceOutFrame: 621,
        keyframeSrc: lighthouseThumbnail,
      },
    ],
    sources: [
      { id: "harbor-recording", s3Location: "s3://sequence-fixtures/harbor.mp4" },
      { id: "lighthouse-recording", s3Location: "s3://sequence-fixtures/lighthouse.mp4" },
    ],
    titles: { harbor: "Harbor", lighthouse: "Lighthouse" },
    keyframes: { harbor: [harborThumbnail], lighthouse: [lighthouseThumbnail] },
  },
} satisfies Meta<EditingHostArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const mainTrack: SequenceTrack = {
  id: "main",
  label: "Main",
  placements: [
    { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
    {
      id: "harbor-close",
      clipId: "harbor",
      sequenceStartFrame: 240,
      sourceInOffsetFrames: 6,
      sourceOutOffsetFrames: 6,
    },
  ],
};

export const AssembleARoughCut: Story = {
  name: "Assemble a rough cut",
  parameters: {
    docs: {
      description: {
        story:
          "Drag Lighthouse from the Clip Pool into the gap to preview where it fits, then drop it. Drag the last Harbor’s trailing edge or drop another clip to the right to extend the sequence. Try trimming a placement after adding an entry or reveal fade; the fade keeps its duration. Click an authored fade indicator to inspect the transition and its owner separately. Use the Inspector for exact source out and fade values, or the ruler and transport to navigate without media. With focus in the editor, press Left or Right Arrow to step the playhead by one sequence frame.",
      },
    },
  },
  args: {
    // [120, 240) is uncovered. The Lighthouse clip has exactly 120 source frames.
    sequence: { durationFrames: 360, tracks: [mainTrack] },
    onSequenceChange: fn(),
    onCutListChange: fn(),
  },
  render: renderEditingHost,
};

export const RearrangeALayeredEdit: Story = {
  name: "Rearrange a layered edit",
  parameters: {
    docs: {
      description: {
        story:
          "Select Harbor on Main and Shift-click Lighthouse on Alternate. Use Inspect placement to switch whose ranges and trim controls the Inspector shows without clearing the selection. Press ] to move the selection one sequence frame later and extend the sequence. Press [ to move it back without shortening the sequence. Drag the selected Lighthouse up to Main and slightly to the right: the Lighthouse on Cutaways blocks Harbor’s proposed destination. Try again farther to the right so Harbor clears the blocker and extends the sequence. Escape cancels a move. Try Undo and Redo after an accepted edit, Rename track to change a display name, or Delete to remove the selection without closing the gaps.",
      },
    },
  },
  args: {
    sequence: {
      durationFrames: 240,
      tracks: [
        {
          id: "cutaways",
          label: "Cutaways",
          placements: [
            {
              id: "lighthouse-open",
              clipId: "lighthouse",
              sequenceStartFrame: 0,
              sourceOutOffsetFrames: -60,
            },
          ],
        },
        {
          id: "main",
          label: "Main",
          placements: [
            {
              id: "harbor-bed",
              clipId: "harbor",
              sequenceStartFrame: 0,
              sourceOutOffsetFrames: 120,
            },
          ],
        },
        {
          id: "alternate",
          label: "Alternate",
          placements: [
            {
              id: "lighthouse-alternate",
              clipId: "lighthouse",
              sequenceStartFrame: 120,
              sourceInOffsetFrames: 6,
              sourceOutOffsetFrames: -6,
            },
          ],
        },
      ],
    },
    onSequenceChange: fn(),
    onCutListChange: fn(),
  },
  render: renderEditingHost,
};

function renderEditingHost({ acceptEdits = true, ...args }: EditingHostArgs) {
  const [, updateArgs] = useArgs<EditingHostArgs>();

  return (
    <SequenceEditor
      {...args}
      onSequenceChange={(next) => {
        args.onSequenceChange?.(next);
        if (acceptEdits) updateArgs({ sequence: next });
        window.dispatchEvent(new CustomEvent("sequence-editor:sequence-change", { detail: next }));
      }}
      onCutListChange={(next) => {
        args.onCutListChange?.(next);
        window.dispatchEvent(new CustomEvent("sequence-editor:cut-list-change", { detail: next }));
      }}
    />
  );
}
