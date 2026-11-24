import type { ReactNode } from "react";
import { SequenceFrameForm } from "@/components/molecules/SequenceFrameForm";
import type { PlacementTransition } from "@/types";

type FrameRange = { startFrame: number; endFrame: number };
type FrameBounds = { min: number; max?: number };
type TransitionContribution = { picture: boolean; audio: boolean };
type InspectorEdge = "start" | "end";
type EdgeAction = { inspectTransition: () => void } | { addTransition?: () => void };

export interface PlacementPropertiesProps {
  placementId: string;
  clipTitle: string;
  locked: boolean;
  sourceRange?: FrameRange;
  sequenceRange?: FrameRange;
  trim?: FrameBounds & { trimPlacement: (sourceOutFrame: number) => void };
  edges: Record<InspectorEdge, EdgeAction>;
  conflict: boolean;
}

export interface TransitionPropertiesProps {
  owner: string;
  edge: InspectorEdge;
  locked: boolean;
  transition: PlacementTransition;
  duration?: FrameBounds & { editDuration: (durationFrames: number) => void };
  sourceExtension: FrameRange | null;
  dissolve?: FrameRange & {
    phaseOffsetFrames: number;
    covered: boolean;
    outgoingExtension: FrameRange | null;
    incomingExtension: FrameRange | null;
    outgoingFallback: TransitionContribution;
    incomingFallback: TransitionContribution;
  };
  conflict: boolean;
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

const edgeLabels = { start: "Start", end: "End" } as const;

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
        {(["start", "end"] as const).map((edge) => {
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
  duration,
  sourceExtension,
  dissolve,
  conflict,
}: TransitionPropertiesProps) {
  const fadeLabel = edge === "start" ? "Entry fade" : "Reveal fade";
  const dissolveEdge = edge === "start" ? "Leading" : "Trailing";
  const kindLabel = transition.kind === "dissolve" ? "Centered dissolve" : fadeLabel;
  const durationLabel = transition.kind === "dissolve" ? `${dissolveEdge} dissolve` : fadeLabel;
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
      {duration && (
        <SequenceFrameForm
          key={`${transition.id}:${transition.kind}:${transition.durationFrames}`}
          id={transition.id}
          label={`${durationLabel} duration (sequence frames)`}
          button={`Apply ${durationLabel.toLowerCase()}`}
          frame={transition.durationFrames}
          min={duration.min}
          max={duration.max}
          onApply={duration.editDuration}
        />
      )}
      {conflict && <ConflictNote />}
    </>
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
