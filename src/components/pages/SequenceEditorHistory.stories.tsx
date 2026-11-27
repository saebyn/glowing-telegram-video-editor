import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { sequenceStoryMedia } from "@/fixtures/sequenceEditor";
import { withSampleProject } from "@/fixtures/video";
import {
  SequenceEditorPage,
  SequenceToolbar,
  useSequenceEditor,
  type Sequence,
  type SequenceToolbarProps,
} from "@/index";

const meta = {
  title: "Examples/Sequence editor history",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const original: Sequence = { tracks: [{ id: "main", label: "Main", placements: [] }] };

function BatchToolbar(props: SequenceToolbarProps) {
  return (
    <>
      <SequenceToolbar {...props} />
      <button
        type="button"
        onClick={() => {
          props.addTrack?.();
          props.addTrack?.();
        }}
      >
        Add two tracks
      </button>
    </>
  );
}

function SavingHost() {
  const [initial, setInitial] = useState(original);
  const [opened, setOpened] = useState(0);
  const [firstSave, setFirstSave] = useState<Sequence>();
  const [notifications, setNotifications] = useState<string[]>([]);
  return (
    <>
      <button
        type="button"
        disabled={!firstSave}
        onClick={() => firstSave && setInitial(firstSave)}
      >
        Receive first save response
      </button>
      <button type="button" onClick={() => setOpened(opened + 1)}>
        Reopen saved snapshot
      </button>
      <output aria-label="Edit notifications">{notifications.join(" → ")}</output>
      <SequenceEditorPage
        key={opened}
        initialSequence={initial}
        clips={[]}
        sources={{}}
        onSequenceChange={(next) => {
          setFirstSave((first) => first ?? next);
          setNotifications((entries) => [...entries, `sequence: ${next.tracks.length} tracks`]);
        }}
        onCutListResult={(result) =>
          setNotifications((entries) => [...entries, `export: ${result.issues[0]?.code}`])
        }
        slots={{ toolbar: BatchToolbar, clipPool: null, preview: null, inspector: null }}
      />
    </>
  );
}

export const EditWhileSaving: StoryObj = { render: () => <SavingHost /> };

function EditFromListener() {
  const [notifications, setNotifications] = useState<string[]>([]);
  const { timelineProps, toolbarProps } = useSequenceEditor({
    ...sequenceStoryMedia,
    initialSequence: original,
    onSequenceChange(next: Sequence): void {
      const hasPlacement = next.tracks.some(({ placements }) => placements.length > 0);
      setNotifications((entries) => [...entries, hasPlacement ? "placement" : "track"]);
      if (!hasPlacement) {
        timelineProps.placeClip?.({ clipId: "harbor", trackId: "main", sequenceFrame: 0 });
      }
    },
    onCutListResult(result) {
      setNotifications((entries) => [...entries, result.ok ? "CutList" : result.issues[0].code]);
    },
  });
  return (
    <>
      <SequenceToolbar {...toolbarProps} />
      <output aria-label="Edit notifications">{notifications.join(" → ")}</output>
    </>
  );
}

export const NotifyInCommitOrder: StoryObj = { render: () => <EditFromListener /> };
