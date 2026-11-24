import type { Meta, StoryObj } from "@storybook/react-vite";
import { withSampleProject } from "@/fixtures/video";
import SequenceEditorPage from "@/components/pages/SequenceEditorPage";

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
