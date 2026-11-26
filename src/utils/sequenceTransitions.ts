import type {
  CutListIssue,
  FrameRate,
  Sequence,
  SequenceSource,
  SourcesById,
  VideoClip,
} from "@/types";
import { getSource } from "./sourcesById";
import { getDissolveWindow } from "./dissolveWindow";
import { hasPresentationTransitionConflict } from "./sequencePresentation";
import {
  resolveVisibleSequence,
  type ResolvedTransition,
  type ResolvedPlacement,
  type VisibleSpan,
} from "./visibleSequence";

function firstSpanEndingAfter(spans: readonly VisibleSpan[], frame: number) {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (spans[mid].end <= frame) low = mid + 1;
    else high = mid;
  }
  return low;
}

type TransitionOutputIssue = Extract<CutListIssue, { transitionId: string }>;

function getFadeContinuations(
  placements: readonly ResolvedPlacement[],
  owner: ResolvedPlacement,
  entry: boolean,
  start: number,
  end: number,
) {
  const pieces = new Set<ResolvedPlacement>();
  let edge = owner;
  while (entry ? edge.sequenceEndFrame < end : edge.sequenceStartFrame > start) {
    const join = entry ? edge.sequenceEndFrame : edge.sequenceStartFrame;
    const next = placements.find(
      (candidate) =>
        candidate.trackIndex === owner.trackIndex &&
        (entry ? candidate.sequenceStartFrame : candidate.sequenceEndFrame) === join &&
        candidate.sourceId === owner.sourceId &&
        sourceAt(candidate, join) === sourceAt(owner, join),
    );
    if (!next) break;
    pieces.add(next);
    edge = next;
  }
  return pieces;
}

function* applyVisibleFades(
  placements: readonly ResolvedPlacement[],
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedTransition[],
  durationFrames: number,
): Generator<TransitionOutputIssue> {
  const claimedCuts = new Set<number>();
  for (const { id, placement, edge, durationFrames: duration, kind } of transitions) {
    if (kind !== "fade") continue;
    const entry = edge === "leading";
    const start = entry ? placement.sequenceStartFrame : placement.sequenceEndFrame - duration;
    const end = entry ? start + duration : placement.sequenceEndFrame;
    const index = firstSpanEndingAfter(spans, start);
    const first = spans[index];
    let overlaps = false;
    if (
      first?.placement === placement &&
      first.end >= end &&
      (entry ? first.start === start : first.end === end)
    ) {
      const neighbor = spans[index + (entry ? -1 : 1)];
      if (
        entry
          ? start > 0 && neighbor?.end !== start
          : end < durationFrames && neighbor?.start !== end
      ) {
        yield { code: "fade-gap", transitionId: id };
      }
      if (entry) first.transitionIn = { type: "fade", duration };
      else first.transitionOut = { type: "fade", duration };
      overlaps =
        (first.transitionIn?.duration ?? 0) + (first.transitionOut?.duration ?? 0) >
        first.end - first.start;
    } else {
      // Beyond the trim, only a source-continuous split can expose a covered owner.
      let ownerVisible = false;
      let continuationVisible = false;
      let continuations: Set<ResolvedPlacement> | undefined;
      for (let i = index; i < spans.length && spans[i].start < end; i++) {
        const visible = spans[i].placement;
        if (visible === placement) {
          ownerVisible = true;
          break;
        }
        if (!continuationVisible && visible.trackIndex === placement.trackIndex) {
          continuations ??= getFadeContinuations(placements, placement, entry, start, end);
          continuationVisible = continuations.has(visible);
        }
      }
      if (ownerVisible || continuationVisible) yield { code: "fade-interrupted", transitionId: id };
      if (!ownerVisible) continue;
    }
    // Even an interrupted fade claims its cut if its owner is visible.
    const cut = entry ? start : end;
    if (overlaps || claimedCuts.has(cut)) yield { code: "fade-overlap", transitionId: id };
    claimedCuts.add(cut);
  }
}

function visibleAt(spans: readonly VisibleSpan[], frame: number) {
  const span = spans[firstSpanEndingAfter(spans, frame)];
  return span && span.start <= frame ? span.placement : undefined;
}

function sourceAt(placement: ResolvedPlacement, frame: number) {
  return placement.sourceInFrame + frame - placement.sequenceStartFrame;
}

function isContinuous(
  spans: readonly VisibleSpan[],
  placement: ResolvedPlacement | undefined,
  start: number,
  end: number,
) {
  if (start >= end) return true;
  let cursor = start;
  for (let i = firstSpanEndingAfter(spans, start); i < spans.length && spans[i].start < end; i++) {
    const span = spans[i];
    if (!placement || span.start > cursor) return false;
    // Report a source discontinuity only when both sides can be compared.
    if (
      span.placement.sourceMappingKnown &&
      placement.sourceMappingKnown &&
      (span.placement.s3Location !== placement.s3Location ||
        sourceAt(span.placement, cursor) !== sourceAt(placement, cursor))
    ) {
      return false;
    }
    cursor = span.end;
  }
  return !placement || cursor >= end;
}

function transitionCut({ edge, placement }: ResolvedTransition) {
  return edge === "leading" ? placement.sequenceStartFrame : placement.sequenceEndFrame;
}

function visibleFadeSpans(spans: readonly VisibleSpan[], fade: ResolvedTransition) {
  const cut = transitionCut(fade);
  const start = fade.edge === "leading" ? cut : cut - fade.durationFrames;
  const end = fade.edge === "leading" ? cut + fade.durationFrames : cut;
  return spans.flatMap((span) =>
    span.placement === fade.placement && span.start < end && span.end > start
      ? [{ startFrame: Math.max(span.start, start), endFrame: Math.min(span.end, end) }]
      : [],
  );
}

function resolveDissolve(
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedTransition[],
  transition: ResolvedTransition,
  sequenceDuration: number,
) {
  const { edge, placement, durationFrames, id } = transition;
  const cut = transitionCut(transition);
  const window = getDissolveWindow(cut, durationFrames, sequenceDuration);
  const outgoing = visibleAt(spans, cut - 1);
  const incoming = visibleAt(spans, cut);
  const ownerSide = edge === "leading" ? incoming : outgoing;
  const covered = !!ownerSide && ownerSide.trackIndex < placement.trackIndex;
  const interrupted =
    !covered &&
    (!isContinuous(spans, outgoing, window.startFrame, cut) ||
      !isContinuous(spans, incoming, cut, window.endFrame));
  const conflict =
    !covered &&
    transitions.some((other) => {
      if (other.id === id) return false;
      const entry = other.edge === "leading";
      const otherCut = transitionCut(other);
      const side = visibleAt(spans, entry ? otherCut : otherCut - 1);
      if (other.kind === "dissolve" && side && side.trackIndex < other.placement.trackIndex)
        return false;
      const otherWindows =
        other.kind === "dissolve"
          ? [getDissolveWindow(otherCut, other.durationFrames, sequenceDuration)]
          : visibleFadeSpans(spans, other);
      return otherWindows.some(
        ({ startFrame, endFrame }) =>
          cut === otherCut || (window.startFrame < endFrame && window.endFrame > startFrame),
      );
    });
  return {
    ...window,
    cut,
    covered,
    interrupted,
    conflict,
    outgoing,
    incoming,
  };
}

function sourceExtension(side: ResolvedPlacement, start: number, end: number) {
  const startFrame = Math.max(0, sourceAt(side, start));
  const endFrame = Math.min(side.knownSourceEnd, sourceAt(side, end));
  return startFrame < endFrame ? { startFrame, endFrame } : null;
}

function dissolvePresentation(
  { outgoing, incoming, ...details }: ReturnType<typeof resolveDissolve>,
  sources: SourcesById<SequenceSource>,
) {
  function missingContribution(side: ResolvedPlacement | undefined) {
    const mediaKind = side && getSource(sources, side.sourceId)?.mediaKind;
    return {
      picture: !side || mediaKind === "audio-only",
      audio: !side || mediaKind === "video-only",
    };
  }
  const { cut, startFrame, endFrame } = details;
  return {
    ...details,
    outgoingExtension: outgoing
      ? sourceExtension(outgoing, Math.max(cut, outgoing.sequenceEndFrame), endFrame)
      : null,
    incomingExtension: incoming
      ? sourceExtension(incoming, startFrame, Math.min(cut, incoming.sequenceStartFrame))
      : null,
    missingOutgoing: !outgoing,
    missingIncoming: !incoming,
    outgoingFallback: missingContribution(outgoing),
    incomingFallback: missingContribution(incoming),
  };
}

export function getSequenceDissolves(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
) {
  const details = new Map<string, ReturnType<typeof dissolvePresentation>>();
  if (
    !sequence.tracks.some(({ placements }) =>
      placements.some(
        ({ transitionIn, transitionOut }) =>
          transitionIn?.kind === "dissolve" || transitionOut?.kind === "dissolve",
      ),
    )
  )
    return details;
  const { layout, issues } = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (layout && !issues.length) {
    for (const transition of layout.transitions) {
      if (transition.kind === "dissolve") {
        details.set(
          transition.id,
          dissolvePresentation(
            resolveDissolve(layout.spans, layout.transitions, transition, layout.durationFrames),
            sources,
          ),
        );
      }
    }
  }
  return details;
}

export function hasTransitionAuthoringConflict(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
  transitionId: string,
) {
  return hasPresentationTransitionConflict(sequence, clips, sources, frameRate, transitionId);
}

function* getDissolveIssues(
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedTransition[],
  duration: number,
): Generator<TransitionOutputIssue> {
  for (const transition of transitions) {
    if (transition.kind !== "dissolve") continue;
    const details = resolveDissolve(spans, transitions, transition, duration);
    if (!details.covered && details.startFrame < details.endFrame) {
      const code = details.conflict
        ? "dissolve-conflict"
        : details.interrupted
          ? "dissolve-interrupted"
          : !details.incoming || !details.outgoing
            ? "dissolve-gap"
            : "unsupported-dissolve";
      yield { code, transitionId: transition.id };
    }
  }
}

/** Attach fades to visible spans in place and collect output issues. */
export function applyCutListTransitions({
  placements,
  spans,
  transitions,
  durationFrames,
}: NonNullable<ReturnType<typeof resolveVisibleSequence>["layout"]>) {
  return [
    ...getDissolveIssues(spans, transitions, durationFrames),
    ...applyVisibleFades(placements, spans, transitions, durationFrames),
  ];
}
