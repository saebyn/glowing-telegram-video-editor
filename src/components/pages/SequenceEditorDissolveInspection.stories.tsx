import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { withSampleProject } from "@/fixtures/video";
import { SequenceEditorPage, type Sequence, type SequenceEditorPageProps } from "@/index";

const sequence: Sequence = {
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "outgoing", clipId: "harbor", sequenceStartFrame: 0 },
        {
          id: "incoming",
          clipId: "lighthouse",
          sequenceStartFrame: 120,
          transitionIn: { id: "dissolve", kind: "dissolve", durationFrames: 9 },
        },
        { id: "later", clipId: "ambience", sequenceStartFrame: 240 },
      ],
    },
  ],
};

type HostArgs = Pick<SequenceEditorPageProps, "onSequenceChange" | "onCutListResult"> & {
  mixedRateOutgoing: boolean;
  missingRenderMetadata: boolean;
};

function DissolveHost({ mixedRateOutgoing, missingRenderMetadata, ...callbacks }: HostArgs) {
  const [laterRate, setLaterRate] = useState(60);
  const clips = sequenceStoryMedia.clips.map((clip) => {
    // The 60 source frames still fill the 120 sequence frames before the cut.
    if (clip.id === "harbor" && mixedRateOutgoing)
      return { ...clip, sourceFrameRate: { numerator: 30, denominator: 1 }, sourceOutFrame: 174 };
    // Equivalent rates need not use the same numerator and denominator.
    if (clip.id === "lighthouse")
      return { ...clip, sourceFrameRate: { numerator: 120, denominator: 2 } };
    if (clip.id === "ambience" && laterRate !== 60)
      return { ...clip, sourceFrameRate: { numerator: laterRate, denominator: 1 } };
    return clip;
  });

  return (
    <>
      <button type="button" onClick={() => setLaterRate(30)}>
        Host: change later clip to 30 fps
      </button>
      <SequenceEditorPage
        {...sequenceStoryMedia}
        {...callbacks}
        clips={clips}
        sources={
          missingRenderMetadata
            ? { ...sequenceStoryMedia.sources, "harbor-audio": undefined }
            : sequenceStoryMedia.sources
        }
        initialSequence={sequence}
        slots={{ clipPool: null, preview: null }}
      />
    </>
  );
}

const meta = {
  title: "Testing/Sequence dissolve inspection",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
  args: {
    mixedRateOutgoing: false,
    missingRenderMetadata: false,
    onSequenceChange: fn(),
    onCutListResult: fn(),
  },
  render: (args: HostArgs) => <DissolveHost {...args} />,
} satisfies Meta<HostArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectWindowAndIncomingExtension(inspector: ReturnType<typeof within>) {
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(
    inspector.getByText("Dissolve window: 116 inclusive – 125 exclusive (sequence frames)"),
  ).toBeVisible();
  await expect(
    inspector.getByText("Incoming extension: 497 inclusive – 501 exclusive (source frames)"),
  ).toBeVisible();
}

async function expectDissolveDetails(inspector: ReturnType<typeof within>) {
  await expectWindowAndIncomingExtension(inspector);
  await expect(
    inspector.getByText("Outgoing extension: 234 inclusive – 239 exclusive (source frames)"),
  ).toBeVisible();
}

export const MissingRenderMetadataOnLoad: Story = {
  args: { missingRenderMetadata: true },
  play: async ({ args, canvas, userEvent }) => {
    const issues = within(canvas.getByRole("region", { name: "CutList issues" }));
    await expect(issues.getByText("Missing source metadata for harbor-audio.")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Select dissolve: Lighthouse" }));

    await expect(args.onSequenceChange).not.toHaveBeenCalled();
    await expect(args.onCutListResult).not.toHaveBeenCalled();
    await expectDissolveDetails(within(canvas.getByRole("region", { name: "Inspector" })));
  },
};

export const UnrelatedRateChangeWhileInspecting: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Select dissolve: Lighthouse" }));
    const inspector = within(canvas.getByRole("region", { name: "Inspector" }));
    await expectDissolveDetails(inspector);

    await userEvent.click(
      canvas.getByRole("button", { name: "Host: change later clip to 30 fps" }),
    );

    const issues = within(canvas.getByRole("region", { name: "CutList issues" }));
    await expect(
      issues.getByText("Source frame rate 30/1 does not match project frame rate 60/1."),
    ).toBeVisible();
    await expect(args.onSequenceChange).not.toHaveBeenCalled();
    await expect(args.onCutListResult).not.toHaveBeenCalled();
    await expectDissolveDetails(inspector);
  },
};

export const MixedRateContributor: Story = {
  args: { mixedRateOutgoing: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Select dissolve: Lighthouse" }));
    const inspector = within(canvas.getByRole("region", { name: "Inspector" }));
    await expectWindowAndIncomingExtension(inspector);
    // Five sequence frames at 60 fps are two and a half native frames at 30 fps.
    await expect(inspector.queryByText(/^Outgoing extension:/)).not.toBeInTheDocument();
  },
};
