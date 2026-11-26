import type { Meta, StoryObj } from "@storybook/react-vite";
import { startTransition, useState } from "react";
import { flushSync } from "react-dom";
import { expect, fn } from "storybook/test";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import {
  SequenceEditorPage,
  type Sequence,
  type SequenceEditorPageProps,
  type SequenceTimelineProps,
} from "@/index";

const firstPlacement = { id: "opening", clipId: "harbor", sequenceStartFrame: 0 };
const original: Sequence = {
  tracks: [{ id: "main", label: "Main", placements: [firstPlacement] }],
};
const clips = [
  {
    id: "harbor",
    sourceId: "harbor-recording",
    sourceInFrame: 100,
    sourceOutFrame: 130,
    sourceFrameRate: sampleFrameRate,
  },
];
const sources = {
  "harbor-recording": {
    s3Location: "s3://sequence-fixtures/harbor.mp4",
    previewHlsUrl: "/fixtures/harbor.m3u8",
  },
};

function RetainedPasteTimeline({ activatePlacement, placementPaste }: SequenceTimelineProps) {
  const confirm = placementPaste?.drop?.confirm;
  return (
    <>
      <button type="button" onClick={() => activatePlacement?.({ placementId: "opening" })}>
        Select Opening
      </button>
      <button
        type="button"
        disabled={!confirm}
        onClick={() =>
          startTransition(() => {
            // The second target still fits after the host accepts the first.
            confirm?.({ trackId: "main", sequenceFrame: 30 });
            confirm?.({ trackId: "main", sequenceFrame: 60 });
          })
        }
      >
        Confirm the same drop twice
      </button>
    </>
  );
}

function SynchronousPasteHost({
  onSequenceChange,
  onCutListResult,
}: Pick<SequenceEditorPageProps, "onSequenceChange" | "onCutListResult">) {
  const [sequence, setSequence] = useState(original);
  return (
    <SequenceEditorPage
      sequence={sequence}
      clips={clips}
      sources={sources}
      onSequenceChange={(next) => {
        onSequenceChange?.(next);
        flushSync(() => setSequence(next));
      }}
      onCutListResult={onCutListResult}
      slots={{
        timeline: RetainedPasteTimeline,
        preview: null,
        clipPool: null,
        toolbar: null,
        inspector: null,
      }}
    />
  );
}

const meta = {
  title: "Testing/Sequence editor paste session",
  component: SynchronousPasteHost,
  decorators: [withSampleProject],
  tags: ["!dev", "!autodocs"],
  args: { onSequenceChange: fn(), onCutListResult: fn() },
} satisfies Meta<typeof SynchronousPasteHost>;

export default meta;

export const ConsumeOnceWithSynchronousAcceptance: StoryObj<typeof meta> = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Select Opening" }));
    await userEvent.keyboard("{Control>}c{/Control}{Control>}v{/Control}");
    const confirm = canvas.getByRole("button", { name: "Confirm the same drop twice" });
    await expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    await expect(confirm).toBeDisabled();
    await expect(args.onSequenceChange).toHaveBeenCalledTimes(1);
    await expect(args.onSequenceChange).toHaveBeenCalledWith({
      tracks: [
        {
          id: "main",
          label: "Main",
          placements: [
            firstPlacement,
            { id: expect.any(String), clipId: "harbor", sequenceStartFrame: 30 },
          ],
        },
      ],
    });
    await expect(args.onCutListResult).toHaveBeenCalledTimes(1);
    await expect(args.onCutListResult).toHaveBeenCalledWith({
      ok: true,
      issues: [],
      cutList: {
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 130 },
              { startFrame: 100, endFrame: 130 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      },
    });
  },
};
