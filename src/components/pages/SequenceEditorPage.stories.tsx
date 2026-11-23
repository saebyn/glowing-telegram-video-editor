import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs, useMemo } from "storybook/preview-api";
import { fn } from "storybook/test";
import harborThumbnail from "@/fixtures/sequence-harbor.svg?no-inline";
import lighthouseThumbnail from "@/fixtures/sequence-lighthouse.svg?no-inline";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import type { SequenceTrack } from "@/types";
import SequenceEditorPage, { type SequenceEditorPageProps } from "./SequenceEditorPage";

type EditingHostArgs = SequenceEditorPageProps & {
  acceptEdits?: boolean;
  readOnly?: boolean;
  startWithoutTracks?: boolean;
  omitPreview?: boolean;
};

const meta = {
  title: "Pages/SequenceEditorPage",
  component: SequenceEditorPage,
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
  argTypes: {
    // Accept nested fixture URL args as well as edits in the Controls panel.
    sequence: { control: "object", type: { name: "object", value: {} } },
    sources: { control: "object", type: { name: "array", value: { name: "object", value: {} } } },
    acceptEdits: { control: "boolean", name: "Accept edits" },
    readOnly: { control: "boolean", name: "Read-only" },
    startWithoutTracks: { control: "boolean", name: "Start without tracks" },
    omitPreview: { control: "boolean", name: "Omit Preview" },
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
    // Preview URLs are placeholders; these stories do not play media.
    sources: [
      {
        id: "harbor-recording",
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        previewHlsUrl: "/fixtures/harbor.m3u8",
      },
      {
        id: "lighthouse-recording",
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        previewHlsUrl: "/fixtures/lighthouse.m3u8",
      },
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
          "Drag the blue playhead grip in the ruler to scrub. Zoom in and drag past the right edge to stop at the last visible sequence frame. The transport shows non-drop-frame timecode above the sequence frame. Forward and Rewind jump about one second, and Stop resets to zero. Press Space on the focused Play or Play reverse button to play or pause. Drag Lighthouse from the Clip Pool into the gap to preview where it fits, then drop it. Drag the last Harbor’s trailing edge or drop another clip to the right to extend the sequence. Click an authored fade indicator to inspect the transition and its owner separately. Use the Inspector for exact source out and fade values. With focus in the editor, press Left or Right Arrow to step the playhead one sequence frame. To assemble from scratch, turn on Start without tracks in Controls. Click Add track, then Undo to return to the empty state.",
      },
    },
  },
  args: {
    // [120, 240) is uncovered. The Lighthouse clip has exactly 120 source frames.
    sequence: { durationFrames: 360, tracks: [mainTrack] },
    onSequenceChange: fn(),
    onCutListResult: fn(),
  },
  render: renderEditingHost,
};

export const RearrangeALayeredEdit: Story = {
  name: "Rearrange a layered edit",
  parameters: {
    docs: {
      description: {
        story:
          "Turn on Split mode and hover over Lighthouse on Cutaways. The blade shows the exact sequence frame that a click will cut. Click Undo, then lock Cutaways and hover again to compare. Escape exits Split mode. Select Harbor on Main and Shift-click Lighthouse on Alternate. Use Inspect placement to switch whose ranges and trim controls the Inspector shows without clearing the selection. Press ] to move the selection one sequence frame later and extend the sequence. Press [ to move it back without shortening the sequence. Drag the selected Lighthouse up to Main and slightly to the right: the Lighthouse on Cutaways blocks Harbor’s proposed destination. Try again farther to the right so Harbor clears the blocker and extends the sequence. Drag the grip on Main to the top to give Harbor priority over Lighthouse without moving any placements within their tracks. Escape cancels a drag. Try Undo and Redo after an accepted edit, Rename track to change a display name, or Delete to remove the selection without closing the gaps.",
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
    onCutListResult: fn(),
  },
  render: renderEditingHost,
};

function renderEditingHost({
  acceptEdits = true,
  readOnly = false,
  startWithoutTracks = false,
  omitPreview = false,
  ...args
}: EditingHostArgs) {
  const [, updateArgs] = useArgs<EditingHostArgs>();
  const durationFrames = args.sequence.durationFrames;
  const empty = useMemo(() => ({ durationFrames, tracks: [] }), [durationFrames]);

  return (
    <SequenceEditorPage
      {...args}
      {...(omitPreview ? { slots: { preview: null } } : {})}
      sequence={startWithoutTracks ? empty : args.sequence}
      onSequenceChange={
        readOnly
          ? undefined
          : (next) => {
              args.onSequenceChange?.(next);
              if (acceptEdits) updateArgs({ sequence: next, startWithoutTracks: false });
              window.dispatchEvent(
                new CustomEvent("sequence-editor:sequence-change", { detail: next }),
              );
            }
      }
      onCutListResult={(result) => {
        args.onCutListResult?.(result);
        window.dispatchEvent(
          new CustomEvent("sequence-editor:cut-list-result", { detail: result }),
        );
      }}
    />
  );
}
