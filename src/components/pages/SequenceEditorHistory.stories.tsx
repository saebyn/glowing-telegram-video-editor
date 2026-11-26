import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { withSampleProject } from "@/fixtures/video";
import { SequenceEditorPage, type Sequence } from "@/index";

const meta = {
  title: "Examples/Sequence editor history",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const original: Sequence = {
  tracks: [{ id: "main", label: "Main", placements: [] }],
};

function ReviewProposals() {
  const [sequence, setSequence] = useState(original);
  const [proposals, setProposals] = useState<Sequence[]>([]);

  return (
    <>
      <section aria-label="Host proposals" className="space-x-2 p-3">
        <p>
          Rename the track and accept the edit. Then propose two more names before accepting one.
        </p>
        {proposals.map((proposal, index) => (
          <button
            key={index}
            type="button"
            className="rounded border px-3 py-1"
            onClick={() => {
              setSequence(proposal);
              setProposals([]);
            }}
          >
            Accept proposal {index + 1}: {proposal.tracks[0]?.label}
          </button>
        ))}
      </section>
      <SequenceEditorPage
        sequence={sequence}
        clips={[]}
        sources={{}}
        onSequenceChange={(proposal) => setProposals((pending) => [...pending, proposal])}
        slots={{ clipPool: null, preview: null, inspector: null }}
      />
    </>
  );
}

export const AcceptAnEarlierProposal: StoryObj = {
  render: () => <ReviewProposals />,
  play: async ({ canvas, step, userEvent }) => {
    const undo = canvas.getByRole("button", { name: "Undo" });
    const timeline = within(canvas.getByRole("region", { name: "Sequence timeline" }));
    const host = within(canvas.getByRole("region", { name: "Host proposals" }));

    async function renameTrack(name: string) {
      await userEvent.click(canvas.getByRole("button", { name: "Rename track" }));
      const dialog = within(canvas.getByRole("dialog", { name: "Rename track" }));
      const field = dialog.getByRole("textbox", { name: "Track name" });
      await userEvent.clear(field);
      await userEvent.type(field, name);
      await userEvent.click(dialog.getByRole("button", { name: "Save name" }));
    }

    async function acceptProposal(number: number, name: string) {
      await userEvent.click(
        host.getByRole("button", { name: `Accept proposal ${number}: ${name}` }),
      );
      await expect(timeline.getByText(name, { exact: true })).toBeVisible();
    }

    await step("Accept a first rename to establish Undo history", async () => {
      await expect(undo).toHaveAttribute("aria-disabled", "true");
      await renameTrack("Assembly");
      await acceptProposal(1, "Assembly");
      await expect(undo).toHaveAttribute("aria-disabled", "false");
    });

    await step("Review two proposals from Assembly and accept the earlier one", async () => {
      await renameTrack("Rough cut");
      await renameTrack("Fine cut");
      await expect(host.getByRole("button", { name: "Accept proposal 2: Fine cut" })).toBeVisible();
      await expect(timeline.getByText("Assembly", { exact: true })).toBeVisible();
      await acceptProposal(1, "Rough cut");
    });

    await step(
      "Undo restores Assembly and then Main, skipping the unaccepted Fine cut",
      async () => {
        await expect(undo).toHaveAttribute("aria-disabled", "false");
        await userEvent.click(undo);
        await acceptProposal(1, "Assembly");
        await userEvent.click(undo);
        await acceptProposal(1, "Main");
        await expect(undo).toHaveAttribute("aria-disabled", "true");
      },
    );
  },
};
