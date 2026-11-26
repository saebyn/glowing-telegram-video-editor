import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import type { Sequence, VideoClip } from "@/types";
import SequenceTimeline from "./SequenceTimeline";
import SequenceToolbar from "./SequenceToolbar";
import { useSequenceEditor } from "./useSequenceEditor";

const meta = {
  title: "Testing/Sequence pool handoff",
  decorators: [withSampleProject],
  tags: ["!dev", "!autodocs"],
} satisfies Meta;

export default meta;

const clips: VideoClip[] = [
  {
    id: "clip",
    sourceId: "source",
    sourceFrameRate: sampleFrameRate,
    sourceDurationFrames: 120,
    sourceInFrame: 0,
    sourceOutFrame: 120,
  },
];
const sources = {
  source: {
    s3Location: "s3://sequence-fixtures/source.mp4",
    previewHlsUrl: "/fixtures/source.m3u8",
  },
};
const titles = { clip: "Example clip" };
const original: Sequence = {
  tracks: [{ id: "main", label: "Main", placements: [] }],
};

const movingPlacement = { id: "moving", clipId: "clip", sequenceStartFrame: 0 };
const moveIntent = {
  placementId: "moving",
  placementIds: ["moving"],
  trackId: "main",
  sequenceFrame: 60,
};

function HandoffHost({ testMove = false }: { testMove?: boolean }) {
  const [sequence, setSequence] = useState<Sequence>(
    testMove
      ? { ...original, tracks: [{ ...original.tracks[0], placements: [movingPlacement] }] }
      : original,
  );
  const [movePreview, setMovePreview] = useState<string>();
  const { toolbarProps, clipPoolProps, timelineProps } = useSequenceEditor({
    sequence,
    clips,
    sources,
    titles,
    onSequenceChange(next) {
      setSequence(next);
      window.dispatchEvent(new CustomEvent("sequence-editor:sequence-change", { detail: next }));
    },
    onCutListResult(result) {
      window.dispatchEvent(new CustomEvent("sequence-editor:cut-list-result", { detail: result }));
    },
  });
  return (
    <>
      <SequenceToolbar {...toolbarProps} />
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData("text/plain", "Example clip");
          clipPoolProps.beginClipDrag?.("clip");
        }}
        onDragEnd={clipPoolProps.endClipDrag}
      >
        Drag Example clip
      </button>
      <button type="button" onClick={clipPoolProps.endClipDrag}>
        End clip handoff
      </button>
      {testMove && (
        <>
          <button
            type="button"
            onClick={() => {
              timelineProps.activatePlacement?.({ placementId: "moving", sequenceFrame: 60 });
            }}
          >
            Activate placement at sequence frame 60
          </button>
          <button
            type="button"
            onClick={() => {
              const result = timelineProps.previewPlacementMove?.(moveIntent);
              setMovePreview(
                result?.kind === "move"
                  ? `Move to ${result.destinations[0]?.sequenceStartFrame}`
                  : "Blocked",
              );
            }}
          >
            Preview placement move
          </button>
          <output aria-label="Move preview">{movePreview}</output>
          <button
            type="button"
            onClick={() => {
              setSequence({ ...sequence, tracks: [{ ...sequence.tracks[0], locked: true }] });
            }}
          >
            Host locks destination
          </button>
          <button type="button" onClick={() => timelineProps.movePlacement?.(moveIntent)}>
            Release placement move
          </button>
          <button
            type="button"
            onClick={() =>
              timelineProps.placeClip?.({ clipId: "clip", trackId: "main", sequenceFrame: 120 })
            }
          >
            Place clip without dragging
          </button>
        </>
      )}
      <SequenceTimeline {...timelineProps} />
    </>
  );
}

export const ReplacementPool: StoryObj = { render: () => <HandoffHost /> };
export const FrameBasedActions: StoryObj = { render: () => <HandoffHost testMove /> };
