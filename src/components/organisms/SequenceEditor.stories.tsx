import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import harborThumbnail from "@/fixtures/sequence-harbor.svg?no-inline";
import lighthouseThumbnail from "@/fixtures/sequence-lighthouse.svg?no-inline";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import type { SequenceTrack } from "@/types";
import SequenceEditor, { type SequenceEditorProps } from "./SequenceEditor";

const meta = {
  title: "Organisms/SequenceEditor",
  component: SequenceEditor,
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
  args: {
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
} satisfies Meta<typeof SequenceEditor>;

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

export const VisualShell: Story = {
  args: {
    sequence: {
      durationFrames: 480,
      tracks: [
        {
          id: "cutaways",
          label: "Cutaways",
          placements: [
            {
              id: "lighthouse-cutaway",
              clipId: "lighthouse",
              sequenceStartFrame: 90,
              entryTransitionFrames: 30,
            },
          ],
        },
        mainTrack,
      ],
    },
  },
};

export const GapFixture: Story = {
  args: {
    // [120, 240) is uncovered. The Lighthouse clip has exactly 120 source frames.
    sequence: { durationFrames: 360, tracks: [mainTrack] },
  },
  render: (args) => <GapHost {...args} />,
};

function GapHost(args: SequenceEditorProps) {
  const [sequence, setSequence] = useState(args.sequence);
  const [cutList, setCutList] = useState<CutList | null | undefined>();

  return (
    <>
      <SequenceEditor
        {...args}
        sequence={sequence}
        onSequenceChange={setSequence}
        onCutListChange={(next) => {
          setCutList(next);
          window.dispatchEvent(
            new CustomEvent("sequence-editor:cut-list-change", { detail: next }),
          );
        }}
      />
      <section className="bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <h2 className="text-lg font-semibold">Emitted CutList</h2>
        <pre className="overflow-x-auto">
          {cutList === undefined ? "No edits yet." : JSON.stringify(cutList, null, 2)}
        </pre>
      </section>
    </>
  );
}
