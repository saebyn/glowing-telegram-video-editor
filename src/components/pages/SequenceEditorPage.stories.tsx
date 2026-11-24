import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs, useMemo, useState } from "storybook/preview-api";
import { fn } from "storybook/test";
import { ProjectProvider } from "@/context/ProjectContext";
import harborDepartureThumbnail from "@/fixtures/sequence-harbor-departure.svg?no-inline";
import harborThumbnail from "@/fixtures/sequence-harbor.svg?no-inline";
import lighthouseThumbnail from "@/fixtures/sequence-lighthouse.svg?no-inline";
import { sampleFrameRate } from "@/fixtures/video";
import type { FrameRate, Sequence, SequenceSource, SequenceTrack, VideoClip } from "@/types";
import SequenceEditorPage, { type SequenceEditorPageProps } from "./SequenceEditorPage";

const harbor: VideoClip = {
  id: "harbor",
  sourceId: "harbor-recording",
  sourceFrameRate: sampleFrameRate,
  sourceDurationFrames: 1_000,
  sourceInFrame: 114,
  sourceOutFrame: 234,
  keyframeSrc: harborThumbnail,
};
const lighthouse: VideoClip = {
  id: "lighthouse",
  sourceId: "lighthouse-recording",
  sourceFrameRate: sampleFrameRate,
  sourceDurationFrames: 1_000,
  sourceInFrame: 501,
  sourceOutFrame: 621,
  keyframeSrc: lighthouseThumbnail,
};
// Preview URLs are placeholders; these stories do not play media.
const harborSource: SequenceSource = {
  s3Location: "s3://sequence-fixtures/harbor.mp4",
  previewHlsUrl: "/fixtures/harbor.m3u8",
};
const lighthouseSource: SequenceSource = {
  s3Location: "s3://sequence-fixtures/lighthouse.mp4",
  previewHlsUrl: "/fixtures/lighthouse.m3u8",
};

type EditingHostArgs = SequenceEditorPageProps & {
  acceptEdits?: boolean;
  readOnly?: boolean;
  reviewEdits?: boolean;
  projectRate?: FrameRate;
  startWithoutTracks?: boolean;
  omitPreview?: boolean;
};

const meta = {
  title: "Pages/SequenceEditorPage",
  component: SequenceEditorPage,
  decorators: [
    (Story, { args }) => (
      <ProjectProvider frameRate={args.projectRate ?? sampleFrameRate}>
        <Story />
      </ProjectProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  argTypes: {
    // Accept nested fixture URL args as well as edits in the Controls panel.
    sequence: { control: "object", type: { name: "object", value: {} } },
    clips: { control: "object", type: { name: "array", value: { name: "object", value: {} } } },
    sources: { control: "object", type: { name: "object", value: {} } },
    acceptEdits: { control: "boolean", name: "Accept edits" },
    readOnly: { control: "boolean", name: "Read-only" },
    reviewEdits: { control: "boolean", name: "Review proposals before applying" },
    projectRate: { control: "object", type: { name: "object", value: {} } },
    startWithoutTracks: { control: "boolean", name: "Start without tracks" },
    omitPreview: { control: "boolean", name: "Omit Preview" },
  },
  args: {
    acceptEdits: true,
    projectRate: sampleFrameRate,
    clips: [harbor, lighthouse],
    sources: { "harbor-recording": harborSource, "lighthouse-recording": lighthouseSource },
    titles: { harbor: "Harbor", lighthouse: "Lighthouse" },
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
          "Hover Harbor and Departure in the Clip Pool to see stills from different ranges of the same source. The last Harbor placement reaches into Departure’s range and shows its still in the timeline. Drag the blue playhead grip in the ruler to scrub. Zoom in and drag past the right edge to stop at the last visible sequence frame. The transport shows non-drop-frame timecode above the sequence frame. Forward and Rewind jump about one second, and Stop resets to zero. Press Space on the focused Play or Play reverse button to play or pause. Drag Lighthouse from the Clip Pool into the gap to preview where it fits, then drop it. Drag the last Harbor’s trailing edge or drop another clip to the right to extend the sequence. Use Add transition on an empty edge in Placement Properties. Click an authored indicator to inspect it, or the strip below it to select its placement. Inspect a narrow or obscured transition from its owning edge. In Transition Properties, Apply the type and duration together or use Remove transition to clear the edge. With focus in the editor, press Left or Right Arrow to step the playhead one sequence frame. To assemble from scratch, turn on Start without tracks in Controls. Click Add track, then Undo to return to the empty state.",
      },
    },
  },
  args: {
    clips: [
      harbor,
      lighthouse,
      { ...harbor, id: "departure", sourceInFrame: 234, sourceOutFrame: 294 },
    ],
    sources: {
      "harbor-recording": {
        ...harborSource,
        frameThumbnails: [
          { sourceFrame: 114, url: harborThumbnail },
          { sourceFrame: 237, url: harborDepartureThumbnail },
        ],
      },
      "lighthouse-recording": lighthouseSource,
    },
    titles: { harbor: "Harbor", lighthouse: "Lighthouse", departure: "Departure" },
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
  reviewEdits = false,
  projectRate: _projectRate,
  startWithoutTracks = false,
  omitPreview = false,
  ...args
}: EditingHostArgs) {
  const [, updateArgs] = useArgs<EditingHostArgs>();
  const [proposal, setProposal] = useState<Sequence | undefined>(undefined);
  const durationFrames = args.sequence.durationFrames;
  const empty = useMemo(() => ({ durationFrames, tracks: [] }), [durationFrames]);

  function accept(next: Sequence) {
    updateArgs({ sequence: next, startWithoutTracks: false });
  }

  return (
    <>
      {reviewEdits && proposal && (
        <div className="flex gap-2 p-2">
          <button
            type="button"
            onClick={() => {
              setProposal(undefined);
              accept(proposal);
            }}
          >
            Accept proposed edit
          </button>
          <button type="button" onClick={() => setProposal(undefined)}>
            Reject proposed edit
          </button>
        </div>
      )}
      <SequenceEditorPage
        {...args}
        {...(omitPreview ? { slots: { preview: null } } : {})}
        sequence={startWithoutTracks ? empty : args.sequence}
        onSequenceChange={
          readOnly
            ? undefined
            : (next) => {
                args.onSequenceChange?.(next);
                if (reviewEdits) setProposal(next);
                else if (acceptEdits) accept(next);
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
    </>
  );
}
