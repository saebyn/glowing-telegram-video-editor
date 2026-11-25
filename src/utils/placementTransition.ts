import type {
  FrameRate,
  ClipPlacement,
  PlacementEdge,
  PlacementTransition,
  Sequence,
  SequenceSource,
  SourcesById,
  TransitionDraft,
  TransitionEditProblem,
  TransitionResizeIntent,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange, transitionFields } from "./clipPlacements";
import { getProjectFrameCount } from "./frames";
import { findPlacementTrack } from "./sequenceTracks";
import { hasTransitionAuthoringConflict } from "./sequenceTransitions";

export type TransitionEditIntent = {
  placementId: string;
  edge: PlacementEdge;
  transition: TransitionDraft;
};

export function getTransitionDurationBounds(
  kind: PlacementTransition["kind"],
  placementFrames: number,
) {
  if (!(placementFrames > 0)) return null;
  if (kind === "dissolve") return { min: 1 };
  return { min: 1, max: placementFrames };
}

type TransitionEdit =
  | { kind: "edit"; sequence: Sequence; transition: PlacementTransition }
  | { kind: "unchanged" }
  | TransitionEditProblem;

export function findTransition(sequence: Sequence, id: string | undefined) {
  if (id === undefined) return undefined;
  for (const track of sequence.tracks) {
    for (const placement of track.placements) {
      for (const edge of ["leading", "trailing"] as const) {
        const transition = placement[transitionFields[edge]];
        if (transition?.id === id) return { track, placement, edge, transition };
      }
    }
  }
}

export function evaluateTransitionResize(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
  { transitionId, durationFrames }: TransitionResizeIntent,
): TransitionEdit {
  const existing = findTransition(sequence, transitionId);
  if (!existing) return { kind: "unavailable" };
  return evaluateTransitionEdit(sequence, clips, sources, frameRate, {
    placementId: existing.placement.id,
    edge: existing.edge,
    transition: { kind: existing.transition.kind, durationFrames },
  });
}

export function evaluateTransitionEdit(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
  { placementId, edge, transition }: TransitionEditIntent,
  allocateTransitionId: () => string = () => crypto.randomUUID(),
): TransitionEdit {
  const track = findPlacementTrack(sequence, placementId);
  const placement = track?.placements.find(({ id }) => id === placementId);
  if (!placement || !track) return { kind: "unavailable" };
  if (track.locked) return { kind: "locked" };
  const field = transitionFields[edge];
  const current = placement[field];
  const clip = clips.find(({ id }) => id === placement.clipId);
  const frames = clip
    ? getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate)
    : 0;
  const bounds = getTransitionDurationBounds(transition.kind, frames);
  if (!bounds) return { kind: "unavailable" };
  const { durationFrames } = transition;
  if (
    !Number.isSafeInteger(durationFrames) ||
    durationFrames < bounds.min ||
    (bounds.max !== undefined && durationFrames > bounds.max)
  )
    return { kind: "invalid-duration", ...bounds };
  if (current?.kind === transition.kind && current.durationFrames === durationFrames)
    return { kind: "unchanged" };

  const authored = { ...transition, id: current?.id ?? allocateTransitionId() };
  const next = replaceTransition(sequence, track, placement, edge, authored);
  if (hasTransitionAuthoringConflict(next, clips, sources, frameRate, authored.id))
    return { kind: "conflict" };
  return { kind: "edit", sequence: next, transition: authored };
}

export function removePlacementTransition(
  sequence: Sequence,
  placementId: string,
  edge: PlacementEdge,
) {
  const track = findPlacementTrack(sequence, placementId);
  const placement = track?.placements.find(({ id }) => id === placementId);
  if (!track || track.locked || !placement?.[transitionFields[edge]]) return null;
  return replaceTransition(sequence, track, placement, edge, undefined);
}

function replaceTransition(
  sequence: Sequence,
  track: Sequence["tracks"][number],
  placement: ClipPlacement,
  edge: PlacementEdge,
  transition: PlacementTransition | undefined,
): Sequence {
  const field = transitionFields[edge];
  const updated = { ...placement };
  if (transition) updated[field] = transition;
  else delete updated[field];
  return {
    ...sequence,
    tracks: sequence.tracks.map((candidate) =>
      candidate === track
        ? {
            ...track,
            placements: track.placements.map((owner) => (owner === placement ? updated : owner)),
          }
        : candidate,
    ),
  };
}
