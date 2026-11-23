import type { ReactNode } from "react";
import {
  SequenceFrameForm,
  type SequenceFrameFormProps,
} from "@/components/molecules/SequenceFrameForm";

type FrameRange = { startFrame: number; endFrame: number };
type TransitionContribution = { picture: boolean; audio: boolean };

export interface SequenceInspectorProps {
  canEdit: boolean;
  locked: boolean;
  selection: readonly { id: string; label: string }[];
  selectedTracks: readonly string[];
  inspectedPlacementId?: string;
  inspectPlacement: (id: string) => void;
  clipTitle?: string;
  sourceRange?: FrameRange;
  sequenceRange?: FrameRange;
  transition?: {
    label: string;
    owner: string;
    durationFrames: number;
    sourceExtension: FrameRange | null;
    dissolve?: FrameRange & {
      phaseOffsetFrames: number;
      covered: boolean;
      outgoingExtension: FrameRange | null;
      incomingExtension: FrameRange | null;
      outgoingFallback: TransitionContribution;
      incomingFallback: TransitionContribution;
    };
  };
  trim?: SequenceFrameFormProps;
  fades: readonly SequenceFrameFormProps[];
  dissolves: readonly SequenceFrameFormProps[];
  dissolveKey?: string;
  showDissolvesOpen: boolean;
  conflict: boolean;
}

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

export default function SequenceInspector({
  canEdit,
  locked,
  selection,
  selectedTracks,
  inspectedPlacementId,
  inspectPlacement,
  clipTitle,
  sourceRange,
  sequenceRange,
  transition,
  trim,
  fades,
  dissolves,
  dissolveKey,
  showDissolvesOpen,
  conflict,
}: SequenceInspectorProps) {
  const dissolve = transition?.dissolve;
  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">Inspector</h2>
      {locked && (
        <p className="mb-2 text-sm">
          This track is locked. Its placements can be inspected but not edited.
        </p>
      )}
      {transition && (
        <div className="mb-3 space-y-1 text-sm">
          <p className="font-medium">{transition.label}</p>
          <p>Owner: {transition.owner}</p>
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
          {transition.sourceExtension && (
            <Range range={transition.sourceExtension} unit="source">
              Transition source extension
            </Range>
          )}
        </div>
      )}
      {selection.length > 1 && (
        <div className="mb-2 space-y-2 text-sm">
          <p>
            {selection.length} placements selected
            <br />
            {selectedTracks.join(", ")}
          </p>
          <label className="block space-y-1">
            <span>Inspect placement</span>
            <select
              className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
              value={inspectedPlacementId}
              onChange={(event) => inspectPlacement(event.currentTarget.value)}
            >
              {selection.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {clipTitle && <p className="mb-2 text-sm font-medium">{clipTitle}</p>}
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
      {trim && (
        <div className="mb-3">
          <SequenceFrameForm key={trim.id} {...trim} />
        </div>
      )}
      {fades.length > 0 && (
        <div className="space-y-3">
          {fades.map((field) => (
            <SequenceFrameForm key={field.id} {...field} />
          ))}
        </div>
      )}
      {selection.length === 0 && !transition && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {canEdit
            ? "Select a placement to edit it."
            : "Placement and transition fields will appear here."}
        </p>
      )}
      {dissolves.length > 0 && (
        <details key={dissolveKey} open={showDissolvesOpen || undefined} className="mt-3 space-y-3">
          <summary className="cursor-pointer text-sm font-medium">Centered dissolves</summary>
          {dissolves.map((field) => (
            <SequenceFrameForm key={field.id} {...field} />
          ))}
        </details>
      )}
      {conflict && (
        <p role="alert" className="text-sm">
          This transition competes with another transition on the same cut or visible frames.
        </p>
      )}
    </>
  );
}
