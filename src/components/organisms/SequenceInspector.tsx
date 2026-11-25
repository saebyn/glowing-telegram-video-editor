import { type ReactNode, useState } from "react";
import { SequenceFrameForm } from "@/components/molecules/SequenceFrameForm";
import type {
  PlacementEdge,
  PlacementTransition,
  TransitionDraft,
  TransitionEditProblem,
} from "@/types";

type FrameRange = { startFrame: number; endFrame: number };
type FrameBounds = { min: number; max?: number };
type TransitionContribution = { picture: boolean; audio: boolean };
type EdgeAction = { inspectTransition: () => void } | { addTransition?: () => void };

export interface PlacementPropertiesProps {
  placementId: string;
  clipTitle: string;
  locked: boolean;
  sourceRange?: FrameRange;
  sequenceRange?: FrameRange;
  trim?: FrameBounds & { trimPlacement: (sourceOutFrame: number) => void };
  edges: Record<PlacementEdge, EdgeAction>;
  conflict: boolean;
}

export interface TransitionPropertiesProps {
  owner: string;
  edge: PlacementEdge;
  locked: boolean;
  transition: PlacementTransition;
  edit?: {
    bounds: (kind: PlacementTransition["kind"]) => FrameBounds | null;
    applyTransition: (draft: TransitionDraft) => void;
    removeTransition: () => void;
  };
  sourceExtension: FrameRange | null;
  dissolve?: FrameRange & {
    phaseOffsetFrames: number;
    covered: boolean;
    outgoingExtension: FrameRange | null;
    incomingExtension: FrameRange | null;
    outgoingFallback: TransitionContribution;
    incomingFallback: TransitionContribution;
  };
  problem?: TransitionEditProblem;
}

export interface SequenceInspectorProps {
  inspection:
    | { kind: "empty"; canEdit: boolean }
    | {
        kind: "placement";
        properties: PlacementPropertiesProps;
        selection: readonly { id: string; label: string }[];
        selectedTracks: readonly string[];
        inspectPlacement: (id: string) => void;
      }
    | { kind: "transition"; properties: TransitionPropertiesProps };
}

const edgeLabels = { leading: "Start", trailing: "End" } as const;

function Range({
  children,
  range,
  unit,
}: {
  children: ReactNode;
  range: FrameRange;
  unit: string;
}) {
  return (
    <p>
      {children}: {range.startFrame} inclusive – {range.endFrame} exclusive ({unit} frames)
    </p>
  );
}

function LockedNote() {
  return (
    <p className="mb-2 text-sm">
      This track is locked. Its placements can be inspected but not edited.
    </p>
  );
}

function ConflictNote() {
  return (
    <p role="alert" className="mt-2 text-sm">
      This transition competes with another transition on the same cut or visible frames.
    </p>
  );
}

export function PlacementProperties({
  placementId,
  clipTitle,
  locked,
  sourceRange,
  sequenceRange,
  trim,
  edges,
  conflict,
}: PlacementPropertiesProps) {
  return (
    <>
      <h3 className="mb-2 font-semibold">Placement Properties</h3>
      {locked && <LockedNote />}
      <p className="mb-2 text-sm font-medium">{clipTitle}</p>
      {sourceRange && sequenceRange && (
        <div className="mb-3 space-y-1 text-sm tabular-nums">
          <p>
            Source in/out (source frames): {sourceRange.startFrame} inclusive –{" "}
            {sourceRange.endFrame} exclusive
          </p>
          <p>
            Sequence start/end (sequence frames): {sequenceRange.startFrame} inclusive –{" "}
            {sequenceRange.endFrame} exclusive
          </p>
        </div>
      )}
      {trim && sourceRange && (
        <div className="mb-3">
          <SequenceFrameForm
            key={`${placementId}:${sourceRange.endFrame}`}
            id={placementId}
            label="Source out (exclusive frame)"
            button="Trim placement"
            frame={sourceRange.endFrame}
            min={trim.min}
            max={trim.max}
            onApply={trim.trimPlacement}
          />
        </div>
      )}
      <div className="space-y-2">
        {(["leading", "trailing"] as const).map((edge) => {
          const action = edges[edge];
          const occupied = "inspectTransition" in action;
          return (
            <fieldset key={edge} className="space-y-1 text-sm">
              <legend className="font-medium">{edgeLabels[edge]} edge</legend>
              <button
                type="button"
                disabled={!occupied && !action.addTransition}
                onClick={occupied ? action.inspectTransition : action.addTransition}
                className="rounded border border-slate-400 px-2 py-1 disabled:opacity-50"
              >
                {occupied ? "Inspect transition" : "Add transition"}
              </button>
            </fieldset>
          );
        })}
      </div>
      {conflict && <ConflictNote />}
    </>
  );
}

export function TransitionProperties({
  owner,
  edge,
  locked,
  transition,
  edit,
  sourceExtension,
  dissolve,
  problem,
}: TransitionPropertiesProps) {
  const fadeLabel = edge === "leading" ? "Entry fade" : "Reveal fade";
  const kindLabel = transition.kind === "dissolve" ? "Dissolve" : fadeLabel;
  return (
    <>
      <h3 className="mb-2 font-semibold">Transition Properties</h3>
      {locked && <LockedNote />}
      <div className="mb-3 space-y-1 text-sm">
        <p className="font-medium">{kindLabel}</p>
        <p>Owner: {owner}</p>
        <p>Edge: {edgeLabels[edge]}</p>
        <p>{transition.durationFrames} sequence frames</p>
        {dissolve && (
          <>
            <Range range={dissolve} unit="sequence">
              Dissolve window
            </Range>
            <p>Linear picture blend and audio crossfade</p>
            {dissolve.phaseOffsetFrames > 0 && (
              <p>
                Blend starts {dissolve.phaseOffsetFrames} sequence frames into its authored phase.
              </p>
            )}
            {dissolve.covered && <p>Covered by a higher track</p>}
            {(
              [
                ["Outgoing", dissolve.outgoingExtension, dissolve.outgoingFallback],
                ["Incoming", dissolve.incomingExtension, dissolve.incomingFallback],
              ] as const
            ).map(([side, extension, fallback]) => (
              <div key={side}>
                {extension && (
                  <Range range={extension} unit="source">
                    {side} extension
                  </Range>
                )}
                {fallback.picture && <p>{side} picture: black</p>}
                {fallback.audio && <p>{side} audio: silence</p>}
              </div>
            ))}
          </>
        )}
        {sourceExtension && (
          <Range range={sourceExtension} unit="source">
            Transition source extension
          </Range>
        )}
      </div>
      {edit && !locked && (
        <TransitionForm
          key={`${transition.id}:${transition.kind}:${transition.durationFrames}`}
          transition={transition}
          {...edit}
        />
      )}
      {problem?.kind === "conflict" && <ConflictNote />}
      {problem?.kind === "invalid-duration" && (
        <p role="alert" className="mt-2 text-sm">
          {problem.max === undefined
            ? "Duration must be a positive whole number of sequence frames."
            : `Duration must be a whole number between ${problem.min} and ${problem.max} sequence frames.`}
        </p>
      )}
      {problem?.kind === "unavailable" && <p role="alert">This transition cannot be edited.</p>}
    </>
  );
}

function TransitionForm({
  transition,
  bounds,
  applyTransition,
  removeTransition,
}: NonNullable<TransitionPropertiesProps["edit"]> & { transition: PlacementTransition }) {
  const [kind, setKind] = useState(transition.kind);
  const durationBounds = bounds(kind);
  const inputClass =
    "block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900";
  return (
    <form
      className="space-y-2 text-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("duration") as HTMLInputElement;
        applyTransition({ kind, durationFrames: input.valueAsNumber });
      }}
    >
      <label className="block space-y-1">
        <span>Type</span>
        <select
          className={inputClass}
          value={kind}
          onChange={(event) => setKind(event.currentTarget.value === "fade" ? "fade" : "dissolve")}
        >
          <option value="fade">Fade</option>
          <option value="dissolve">Dissolve</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span>Duration (sequence frames)</span>
        <input
          className={inputClass}
          name="duration"
          type="number"
          required
          step={1}
          defaultValue={transition.durationFrames}
          min={durationBounds?.min}
          max={durationBounds?.max}
        />
      </label>
      <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white dark:bg-slate-600">
        Apply
      </button>
      <button
        type="button"
        onClick={removeTransition}
        className="ml-2 rounded border border-slate-400 px-2 py-1"
      >
        Remove transition
      </button>
    </form>
  );
}

export default function SequenceInspector({ inspection }: SequenceInspectorProps) {
  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">Inspector</h2>
      {inspection.kind === "empty" && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {inspection.canEdit
            ? "Select a placement to edit it."
            : "Select a placement or transition to inspect it."}
        </p>
      )}
      {inspection.kind === "placement" && (
        <>
          {inspection.selection.length > 1 && (
            <div className="mb-2 space-y-2 text-sm">
              <p>
                {inspection.selection.length} placements selected
                <br />
                {inspection.selectedTracks.join(", ")}
              </p>
              <label className="block space-y-1">
                <span>Inspect placement</span>
                <select
                  className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                  value={inspection.properties.placementId}
                  onChange={(event) => inspection.inspectPlacement(event.currentTarget.value)}
                >
                  {inspection.selection.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <PlacementProperties {...inspection.properties} />
        </>
      )}
      {inspection.kind === "transition" && <TransitionProperties {...inspection.properties} />}
    </>
  );
}
