import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import {
  SequenceClipPool,
  SequenceEditorPage,
  SequenceInspector,
  SequencePreview,
  SequenceTimeline,
  SequenceToolbar,
  SequenceWorkspace,
  useSequenceEditor,
  type Sequence,
  type SequenceEditorPageProps,
  type SequenceEditorSlots,
  type SequenceInspectorProps,
  type SequencePreviewProps,
  type SequenceTimelineProps,
  type VideoClip,
} from "@/index";

const meta = {
  title: "Examples/Sequence editor composition",
  decorators: [withSampleProject],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const clips: VideoClip[] = [
  {
    id: "harbor",
    sourceId: "harbor-recording",
    sourceFrameRate: sampleFrameRate,
    sourceInFrame: 100,
    sourceOutFrame: 160,
    sourceDurationFrames: 500,
  },
  {
    id: "bridge",
    sourceId: "bridge-recording",
    sourceFrameRate: sampleFrameRate,
    sourceInFrame: 300,
    sourceOutFrame: 360,
  },
];
const sources = {
  "harbor-recording": {
    s3Location: "s3://sequence-fixtures/harbor.mp4",
    previewHlsUrl: "/fixtures/harbor.m3u8",
  },
  "bridge-recording": {
    s3Location: "s3://sequence-fixtures/bridge.mp4",
    previewHlsUrl: "/fixtures/bridge.m3u8",
  },
};
const titles = { harbor: "Harbor", bridge: "Bridge" };
const original: Sequence = {
  durationFrames: 240,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
        { id: "closing", clipId: "harbor", sequenceStartFrame: 120, sourceOutOffsetFrames: 60 },
      ],
    },
  ],
};

function PreviewSnapshot({ playheadFrame, durationFrames, playback }: SequencePreviewProps) {
  return (
    <div>
      <h2 className="font-semibold">Preview transport snapshot</h2>
      <p>
        Sequence frame{" "}
        <output aria-label="Preview sequence frame" aria-live="off">
          {playheadFrame}
        </output>
        {" of "}
        {durationFrames} · {playback}
      </p>
    </div>
  );
}

function WrappedInspector(props: SequenceInspectorProps) {
  return (
    <section aria-label="Wrapped Inspector">
      <p className="mb-2 text-xs">
        {props.inspection.kind === "transition"
          ? "Project notes and transition details"
          : "Project notes and placement details"}
      </p>
      <SequenceInspector {...props} />
    </section>
  );
}

function FrameBasedTimeline({
  playheadFrame,
  durationFrames,
  tracks,
  onSeek,
  previewClipPlacement,
  placeClip,
  previewTransitionResize,
  resizeTransition,
}: SequenceTimelineProps) {
  const [showPreview, setShowPreview] = useState(false);
  const track = tracks[0];
  const intent = track && { clipId: "bridge", trackId: track.id, sequenceFrame: playheadFrame };
  const preview = showPreview && intent && previewClipPlacement?.(intent);
  const transitions = track?.placements.flatMap((placement) =>
    [placement.transitionIn, placement.transitionOut].flatMap((transition) =>
      transition ? [{ ...transition, owner: placement.id }] : [],
    ),
  );
  return (
    <section aria-label="Frame-based timeline" className="space-y-2 rounded border p-3">
      <h2 className="font-semibold">Frame-based timeline</h2>
      <label className="block">
        Seek by sequence frame{" "}
        <input
          type="number"
          min={0}
          max={durationFrames}
          step={1}
          value={playheadFrame}
          onChange={(event) => {
            if (Number.isSafeInteger(event.currentTarget.valueAsNumber))
              onSeek(event.currentTarget.valueAsNumber);
          }}
        />
      </label>
      <p>
        Sequence frame{" "}
        <output aria-label="Timeline sequence frame" aria-live="off">
          {playheadFrame}
        </output>
      </p>
      <p>
        Placements <output aria-label="Placement count">{track?.placements.length ?? 0}</output>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={!intent || !previewClipPlacement}
          onClick={() => setShowPreview(true)}
        >
          Preview placement
        </button>
        <button
          type="button"
          disabled={!intent || !placeClip}
          onClick={() => {
            if (intent) placeClip?.(intent);
            setShowPreview(false);
          }}
        >
          Place clip
        </button>
      </div>
      {preview && (
        <output aria-label="Placement preview">
          {preview.kind === "place"
            ? `Fits at sequence frame ${preview.sequenceStartFrame}`
            : `Blocked: ${preview.reason}`}
        </output>
      )}
      {!!transitions?.length && (
        <TransitionResizeControls
          transitions={transitions}
          previewTransitionResize={previewTransitionResize}
          resizeTransition={resizeTransition}
        />
      )}
    </section>
  );
}

function TransitionResizeControls({
  transitions,
  previewTransitionResize,
  resizeTransition,
}: Pick<SequenceTimelineProps, "previewTransitionResize" | "resizeTransition"> & {
  transitions: { id: string; kind: "fade" | "dissolve"; owner: string }[];
}) {
  const [selected, setSelected] = useState(transitions[0]?.id);
  const [duration, setDuration] = useState("8");
  const [preview, setPreview] = useState<string>();
  const transitionId = selected ?? transitions[0]?.id;
  const intent = transitionId ? { transitionId, durationFrames: Number(duration) } : undefined;
  return (
    <fieldset className="space-x-2">
      <legend>Resize an authored transition by ID</legend>
      <label>
        Transition to resize{" "}
        <select
          value={transitionId}
          onChange={(event) => {
            setSelected(event.currentTarget.value);
            setPreview(undefined);
          }}
        >
          {transitions.map(({ id, kind, owner }) => (
            <option key={id} value={id}>
              {kind === "fade" ? "Fade" : "Dissolve"} — {owner}
            </option>
          ))}
        </select>
      </label>
      <label>
        Proposed transition duration{" "}
        <input
          type="number"
          min={1}
          step={1}
          value={duration}
          onChange={(event) => {
            setDuration(event.currentTarget.value);
            setPreview(undefined);
          }}
        />
      </label>
      <button
        type="button"
        disabled={!intent || !previewTransitionResize}
        onClick={() => {
          if (!intent || !previewTransitionResize) return;
          const result = previewTransitionResize(intent);
          setPreview(
            result === "valid" ? `Fits at ${intent.durationFrames} sequence frames` : result,
          );
        }}
      >
        Preview resize
      </button>
      <button
        type="button"
        disabled={!intent || !resizeTransition}
        onClick={() => {
          if (intent) resizeTransition?.(intent);
          setPreview(undefined);
        }}
      >
        Resize transition
      </button>
      {preview && <output aria-label="Transition resize preview">{preview}</output>}
    </fieldset>
  );
}

const slots = {
  inspector: WrappedInspector,
  preview: PreviewSnapshot,
  timeline: FrameBasedTimeline,
} satisfies SequenceEditorSlots;

function useControlledStory(manualFirstEdit = false, initialSequence = original) {
  const [sequence, setSequence] = useState(initialSequence);
  const [pending, setPending] = useState<Sequence>();
  const [autoAccept, setAutoAccept] = useState(!manualFirstEdit);
  const options: SequenceEditorPageProps = {
    sequence,
    clips,
    sources,
    titles,
    onSequenceChange(next) {
      if (autoAccept) setSequence(next);
      else setPending(next);
      window.dispatchEvent(new CustomEvent("sequence-editor:sequence-change", { detail: next }));
    },
    onCutListResult(result) {
      window.dispatchEvent(new CustomEvent("sequence-editor:cut-list-result", { detail: result }));
    },
  };
  return {
    options,
    pending,
    acceptProposal() {
      if (!pending) return;
      setSequence(pending);
      setPending(undefined);
      setAutoAccept(true);
    },
  };
}

function PageSlotExample() {
  const { options, pending, acceptProposal } = useControlledStory(true);
  return (
    <>
      <p className="p-3">
        Seek to frame 60. Preview and place Bridge, then accept the proposal to enable Undo.
      </p>
      <button
        className="mx-3 rounded border px-3 py-1"
        type="button"
        disabled={!pending}
        onClick={acceptProposal}
      >
        Accept proposal
      </button>
      <SequenceEditorPage {...options} slots={slots} />
    </>
  );
}

function HookExample() {
  const { options } = useControlledStory();
  const {
    toolbarProps,
    timelineProps,
    previewProps,
    clipPoolProps,
    inspectorProps,
    notices,
    handleEditorKeyDown,
  } = useSequenceEditor(options);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      aria-label="Host-built sequence editor"
      className="space-y-4 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
    >
      <SequenceToolbar {...toolbarProps} />
      {notices.map((notice) => (
        <output key={notice}>{notice}</output>
      ))}
      <SequenceTimeline {...timelineProps} />
      <SequenceWorkspace
        inspector={<SequenceInspector {...inspectorProps} />}
        preview={<SequencePreview {...previewProps} />}
        clipPool={<SequenceClipPool {...clipPoolProps} />}
      />
    </section>
  );
}

export const ReplacePageSlots: StoryObj = {
  name: "Replace page slots",
  render: () => <PageSlotExample />,
};

export const AssembleWithTheHook: StoryObj = {
  name: "Assemble with the hook",
  render: () => <HookExample />,
};

const transitionsExample: Sequence = {
  durationFrames: 240,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        {
          ...original.tracks[0].placements[0],
          transitionIn: { id: "opening-fade", kind: "fade", durationFrames: 8 },
        },
        { id: "bridge", clipId: "bridge", sequenceStartFrame: 60 },
        {
          ...original.tracks[0].placements[1],
          transitionIn: { id: "closing-dissolve", kind: "dissolve", durationFrames: 6 },
        },
      ],
    },
  ],
};

function ResizeTransitionsExample() {
  const { options } = useControlledStory(false, transitionsExample);
  return <SequenceEditorPage {...options} slots={slots} />;
}

export const ResizeATransition: StoryObj = {
  name: "Resize a transition",
  render: () => <ResizeTransitionsExample />,
};
