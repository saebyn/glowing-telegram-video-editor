import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useRef, useState } from "react";
import { sampleFrameRate, withSampleProject } from "@/fixtures/video";
import {
  ProjectProvider,
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
  type SequenceToolbarProps,
  type VideoClip,
} from "@/index";
import SequenceCutListIssues from "@/components/organisms/SequenceCutListIssues";

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
  const releaseResize = useRef<(() => void) | undefined>(undefined);
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
        onPointerDown={() => {
          if (intent && resizeTransition) releaseResize.current = () => resizeTransition(intent);
        }}
        onPointerCancel={() => {
          releaseResize.current = undefined;
        }}
        onClick={() => {
          if (releaseResize.current) releaseResize.current();
          else if (intent) resizeTransition?.(intent);
          releaseResize.current = undefined;
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
  const [pool, setPool] = useState(clips);
  const [pending, setPending] = useState<Sequence>();
  const [autoAccept, setAutoAccept] = useState(!manualFirstEdit);
  const options: SequenceEditorPageProps = {
    sequence,
    clips: pool,
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
    setSequence,
    setPool,
    lockTopTrack() {
      setSequence((current) => ({
        ...current,
        tracks: current.tracks.map((track, index) =>
          index === 0 ? { ...track, locked: true } : track,
        ),
      }));
    },
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
        Seek to frame 60. Preview and place Bridge, then accept the proposal to enable Undo. This
        replacement Timeline does not register viewport navigation.
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

function FitOnlyTimeline({ registerNavigation }: SequenceTimelineProps) {
  const [fitRequests, setFitRequests] = useState(0);
  useLayoutEffect(
    () => registerNavigation?.({ fitToView: () => setFitRequests((requests) => requests + 1) }),
    [registerNavigation],
  );
  return (
    <p>
      Fit requests: <output aria-label="Fit requests">{fitRequests}</output>
    </p>
  );
}

function HookExample() {
  const { options } = useControlledStory();
  const [showTimeline, setShowTimeline] = useState(true);
  const [fitOnly, setFitOnly] = useState(false);
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
      <p>Try the default navigation buttons, then switch to a Timeline that only supports Fit.</p>
      <button type="button" onClick={() => setFitOnly((current) => !current)}>
        {fitOnly ? "Use the default timeline" : "Use a fit-only timeline"}
      </button>
      <button type="button" onClick={() => setShowTimeline((current) => !current)}>
        {showTimeline ? "Hide timeline" : "Show timeline"}
      </button>
      {notices.map((notice) => (
        <output key={notice}>{notice}</output>
      ))}
      {showTimeline &&
        (fitOnly ? (
          <FitOnlyTimeline {...timelineProps} />
        ) : (
          <SequenceTimeline {...timelineProps} />
        ))}
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

function InputReplacementExample() {
  const [replacement, setReplacement] = useState(0);
  const rates = [
    sampleFrameRate,
    { numerator: 29.97, denominator: 1 },
    { denominator: 1, numerator: 29.97 },
    { numerator: 0, denominator: 1 },
    sampleFrameRate,
    { numerator: 29.97, denominator: 1 },
  ];
  return (
    <ProjectProvider frameRate={rates[replacement]}>
      <button type="button" onClick={() => setReplacement((n) => (n + 1) % rates.length)}>
        Replace host inputs
      </button>
      <p>Host input replacement {replacement}</p>
      <InputReplacementEditor />
    </ProjectProvider>
  );
}

function InputReplacementEditor() {
  const { options } = useControlledStory();
  const { toolbarProps, timelineProps, previewProps, cutListIssues } = useSequenceEditor({
    ...options,
    onSequenceInputError(issues) {
      window.dispatchEvent(new CustomEvent("sequence-editor:input-error", { detail: issues }));
    },
  });
  const retained = useRef<SequenceToolbarProps>(undefined);
  return (
    <>
      <button type="button" onClick={() => (retained.current = toolbarProps)}>
        Retain slot actions
      </button>
      <button
        type="button"
        onClick={() => {
          retained.current?.addTrack?.();
          retained.current?.transport.seek(12);
          retained.current?.transport.playForward();
        }}
      >
        Invoke retained edit and transport
      </button>
      <SequenceToolbar {...toolbarProps} />
      <PreviewSnapshot {...previewProps} />
      <SequenceCutListIssues
        issues={cutListIssues}
        frameRate={timelineProps.frameRate}
        onSeek={timelineProps.onSeek}
      />
      <SequenceTimeline {...timelineProps} />
    </>
  );
}

export const ReplaceInvalidInputs: StoryObj = {
  name: "Replace invalid inputs",
  render: () => <InputReplacementExample />,
};

const transitionsExample: Sequence = {
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
  const { options, lockTopTrack } = useControlledStory(false, transitionsExample);
  return (
    <>
      <button type="button" onClick={lockTopTrack}>
        Host: lock Main
      </button>
      <SequenceEditorPage {...options} slots={slots} />
    </>
  );
}

export const ResizeATransition: StoryObj = {
  name: "Resize a transition",
  render: () => <ResizeTransitionsExample />,
};

function RetainedPlacementTimeline({
  previewClipPlacement,
  placeClip,
  previewPlacementMove,
  movePlacement,
  previewTrim,
  trimPlacement,
}: SequenceTimelineProps) {
  const [release, setRelease] = useState<() => void>();
  const drop = { clipId: "bridge", trackId: "main", sequenceFrame: 60 };
  const move = {
    placementId: "closing",
    placementIds: ["closing"],
    trackId: "main",
    sequenceFrame: 60,
  };
  const trim = { placementId: "opening", edge: "trailing", sourceFrame: 220 } as const;

  return (
    <section aria-label="Retained placement actions" className="space-x-3 rounded border p-3">
      <button
        type="button"
        disabled={!placeClip || previewClipPlacement?.(drop)?.kind !== "place"}
        onClick={() => setRelease(() => () => placeClip?.(drop))}
      >
        Capture pool drop
      </button>
      <button
        type="button"
        disabled={!movePlacement || previewPlacementMove?.(move).kind !== "move"}
        onClick={() => setRelease(() => () => movePlacement?.(move))}
      >
        Capture placement move
      </button>
      <button
        type="button"
        disabled={!trimPlacement || !previewTrim?.(trim)}
        onClick={() => setRelease(() => () => trimPlacement?.(trim))}
      >
        Capture placement trim
      </button>
      <button
        type="button"
        disabled={!release}
        onClick={() => {
          release?.();
          setRelease(undefined);
        }}
      >
        Release retained action
      </button>
    </section>
  );
}

function RetainedPlacementActionsExample() {
  const { options, lockTopTrack, setSequence, setPool } = useControlledStory();

  function addReserveTrack() {
    setSequence((current) => ({
      ...current,
      tracks: [
        ...current.tracks,
        {
          id: "reserve",
          label: "Reserve",
          placements: [{ id: "tail", clipId: "bridge", sequenceStartFrame: 180 }],
        },
      ],
    }));
  }

  function trimHarborClip() {
    setPool((current) =>
      current.map((clip) => (clip.id === "harbor" ? { ...clip, sourceOutFrame: 148 } : clip)),
    );
    setSequence((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        // Shortening the pool clip by 12 source frames keeps existing placements' out points.
        placements: track.placements.map((placement) =>
          placement.clipId === "harbor"
            ? { ...placement, sourceOutOffsetFrames: (placement.sourceOutOffsetFrames ?? 0) + 12 }
            : placement,
        ),
      })),
    }));
  }

  return (
    <>
      <p>Capture an action, change the host inputs, then release the original callback.</p>
      <button type="button" onClick={lockTopTrack}>
        Host: lock Main
      </button>
      <button
        type="button"
        disabled={options.sequence.tracks.some(({ id }) => id === "reserve")}
        onClick={addReserveTrack}
      >
        Host: add Reserve track
      </button>
      <button
        type="button"
        disabled={options.clips.find(({ id }) => id === "harbor")?.sourceOutFrame === 148}
        onClick={trimHarborClip}
      >
        Host: trim Harbor pool clip
      </button>
      <SequenceEditorPage
        {...options}
        slots={{ timeline: RetainedPlacementTimeline, preview: PreviewSnapshot }}
      />
    </>
  );
}

export const ReleaseRetainedPlacementActions: StoryObj = {
  name: "Release retained placement actions",
  render: () => <RetainedPlacementActionsExample />,
};
