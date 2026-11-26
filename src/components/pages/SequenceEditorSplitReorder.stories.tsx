import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { withSampleProject } from "@/fixtures/video";
import { SequenceEditorPage, type Sequence } from "@/index";

const meta = {
  title: "Testing/Sequence split reorder",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const initial: Sequence = {
  durationFrames: 180,
  tracks: [
    {
      id: "harbor",
      label: "Harbor angle",
      placements: [{ id: "harbor-placement", clipId: "harbor", sequenceStartFrame: 30 }],
    },
    {
      id: "lighthouse",
      label: "Lighthouse angle",
      placements: [{ id: "lighthouse-placement", clipId: "lighthouse", sequenceStartFrame: 30 }],
    },
    { id: "empty", label: "Empty", placements: [] },
    {
      id: "locked",
      label: "Locked sound",
      locked: true,
      placements: [
        {
          id: "ambience-placement",
          clipId: "ambience",
          sequenceStartFrame: 30,
          sourceOutOffsetFrames: -120,
        },
      ],
    },
  ],
};

function ReorderingHost() {
  const [sequence, setSequence] = useState(initial);

  return (
    <>
      <section aria-label="Host controls" className="space-x-2 p-3">
        <p>In Split mode, hover over the top placement and use the keyboard to reorder tracks.</p>
        {initial.tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="rounded border px-3 py-1"
            onClick={() =>
              setSequence((current) => {
                const index = current.tracks.findIndex(({ id }) => id === track.id);
                const tracks = [...current.tracks];
                tracks.unshift(...tracks.splice(index, 1));
                return { ...current, tracks };
              })
            }
          >
            Bring {track.label} to top
          </button>
        ))}
      </section>
      <SequenceEditorPage
        {...sequenceStoryMedia}
        sequence={sequence}
        slots={{ clipPool: null, preview: null, inspector: null }}
        onSequenceChange={(next) => {
          window.dispatchEvent(
            new CustomEvent("sequence-editor:sequence-change", { detail: next }),
          );
          setSequence(next);
        }}
        onCutListResult={(result) =>
          window.dispatchEvent(
            new CustomEvent("sequence-editor:cut-list-result", { detail: result }),
          )
        }
      />
    </>
  );
}

export const HostReordersTracks: StoryObj = {
  render: () => <ReorderingHost />,
};
