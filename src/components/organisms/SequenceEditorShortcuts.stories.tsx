import type { Meta, StoryObj } from "@storybook/react-vite";
import { withSampleProject } from "@/fixtures/video";
import SequenceEditorPage from "@/components/pages/SequenceEditorPage";
import { useState } from "react";
import type { Sequence } from "@/types";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";

const meta = {
  title: "Testing/Sequence editor shortcuts",
  decorators: [withSampleProject],
  tags: ["!dev", "!autodocs"],
} satisfies Meta;

export default meta;

export const TwoEditors: StoryObj = {
  render() {
    const sequence = { durationFrames: 120, tracks: [] };
    return (
      <>
        <button type="button">Outside both editors</button>
        {["First editor", "Second editor"].map((label) => (
          <section key={label} aria-label={label}>
            <SequenceEditorPage
              sequence={sequence}
              clips={[]}
              sources={{}}
              onSequenceChange={() => {}}
            />
          </section>
        ))}
      </>
    );
  },
};

const clipboardSequence: Sequence = {
  durationFrames: 360,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [{ id: "opening", clipId: "harbor", sequenceStartFrame: 0 }],
    },
  ],
};

function ClipboardEditingHost() {
  const [sequence, setSequence] = useState(clipboardSequence);
  return (
    <>
      <button type="button" onClick={() => setSequence({ ...clipboardSequence })}>
        Replace sequence
      </button>
      <SequenceEditorPage
        {...sequenceStoryMedia}
        sequence={sequence}
        onSequenceChange={setSequence}
        slots={{ preview: null }}
      />
    </>
  );
}

export const ClipboardHost: StoryObj = { render: () => <ClipboardEditingHost /> };
