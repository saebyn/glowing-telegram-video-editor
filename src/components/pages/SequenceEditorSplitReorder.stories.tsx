import type { Meta, StoryObj } from "@storybook/react-vite";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { withSampleProject } from "@/fixtures/video";
import {
  SequenceEditorPage,
  SequenceTimeline,
  type Sequence,
  type SequenceTimelineProps,
} from "@/index";

const meta = {
  title: "Testing/Sequence split reorder",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const initial: Sequence = {
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
  return (
    <SequenceEditorPage
      {...sequenceStoryMedia}
      initialSequence={initial}
      slots={{ clipPool: null, preview: null, inspector: null, timeline: ReorderingTimeline }}
      onSequenceChange={(next) => {
        window.dispatchEvent(new CustomEvent("sequence-editor:sequence-change", { detail: next }));
      }}
      onCutListResult={(result) =>
        window.dispatchEvent(new CustomEvent("sequence-editor:cut-list-result", { detail: result }))
      }
    />
  );
}

function ReorderingTimeline(props: SequenceTimelineProps) {
  return (
    <>
      <section aria-label="Track order controls" className="space-x-2 p-3">
        <p>In Split mode, hover over the top placement and use the keyboard to reorder tracks.</p>
        {initial.tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="rounded border px-3 py-1"
            onClick={() => props.reorderTrack?.(track.id, props.tracks[0].id)}
          >
            Bring {track.label} to top
          </button>
        ))}
      </section>
      <SequenceTimeline {...props} />
    </>
  );
}

export const HostReordersTracks: StoryObj = {
  render: () => <ReorderingHost />,
};
