import type { CutListIssue, FrameRate, Sequence, SequenceSource, VideoClip } from "@/types";
import { getDissolveWindow } from "./dissolveWindow";
import {
  resolveVisibleSequence,
  type ResolvedFade,
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

function* applyVisibleFades(
  spans: readonly VisibleSpan[],
  fades: readonly ResolvedFade[],
  durationFrames: number,
): Generator<TransitionOutputIssue> {
  for (const { id, placement, edge, duration, kind } of fades) {
    if (kind !== "fade") continue;
    const entry = edge === "entry";
    const start = entry ? placement.sequenceStartFrame : placement.sequenceEndFrame - duration;
    const end = entry ? start + duration : placement.sequenceEndFrame;
    const index = firstSpanEndingAfter(spans, start);
    const first = spans[index];
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
      if (
        (first.transitionIn?.duration ?? 0) + (first.transitionOut?.duration ?? 0) >
        first.end - first.start
      ) {
        yield { code: "fade-overlap", transitionId: id };
      }
    } else {
      // A hidden edge is harmless only when higher tracks obscure the entire window.
      let coveredTo = Math.max(0, start);
      const visibleEnd = Math.min(durationFrames, end);
      for (let i = index; i < spans.length && spans[i].start < visibleEnd; i++) {
        const span = spans[i];
        if (span.start > coveredTo || span.placement.trackIndex >= placement.trackIndex) {
          break;
        }
        coveredTo = span.end;
      }
      if (coveredTo < visibleEnd) yield { code: "fade-interrupted", transitionId: id };
    }
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

function transitionCut({ edge, placement }: ResolvedFade) {
  return edge === "entry" ? placement.sequenceStartFrame : placement.sequenceEndFrame;
}

function resolveDissolve(
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedFade[],
  transition: ResolvedFade,
  sequenceDuration: number,
) {
  const { edge, placement, duration, id } = transition;
  const cut = transitionCut(transition);
  const window = getDissolveWindow(cut, duration, sequenceDuration);
  const outgoing = visibleAt(spans, cut - 1);
  const incoming = visibleAt(spans, cut);
  const ownerSide = edge === "entry" ? incoming : outgoing;
  const covered = !!ownerSide && ownerSide.trackIndex < placement.trackIndex;
  const interrupted =
    !covered &&
    (!isContinuous(spans, outgoing, window.startFrame, cut) ||
      !isContinuous(spans, incoming, cut, window.endFrame));
  const conflict =
    !covered &&
    transitions.some((other) => {
      if (other.id === id) return false;
      const entry = other.edge === "entry";
      const otherCut = transitionCut(other);
      const side = visibleAt(spans, entry ? otherCut : otherCut - 1);
      if (other.kind === "dissolve" && side && side.trackIndex < other.placement.trackIndex)
        return false;
      const start = entry ? otherCut : otherCut - other.duration;
      const end = entry ? otherCut + other.duration : otherCut;
      const otherWindow =
        other.kind === "dissolve"
          ? getDissolveWindow(otherCut, other.duration, sequenceDuration)
          : { startFrame: start, endFrame: end };
      if (
        other.kind === "fade" &&
        !spans.some(
          (span) => span.placement === other.placement && span.start < end && span.end > start,
        )
      )
        return false;
      return (
        cut === otherCut ||
        (window.startFrame < otherWindow.endFrame && window.endFrame > otherWindow.startFrame)
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
  sources: readonly SequenceSource[],
) {
  function missingContribution(side: ResolvedPlacement | undefined) {
    const mediaKind = side && sources.find(({ id }) => id === side.sourceId)?.mediaKind;
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
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
) {
  const details = new Map<string, ReturnType<typeof dissolvePresentation>>();
  if (
    !sequence.tracks.some(({ placements }) =>
      placements.some(
        ({ entryTransition, revealTransition }) =>
          entryTransition?.kind === "dissolve" || revealTransition?.kind === "dissolve",
      ),
    )
  )
    return details;
  const { layout, issues } = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (layout && !issues.length) {
    for (const transition of layout.fades) {
      if (transition.kind === "dissolve") {
        details.set(
          transition.id,
          dissolvePresentation(
            resolveDissolve(layout.spans, layout.fades, transition, sequence.durationFrames),
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
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
  transitionId: string,
) {
  const { layout, issues } = resolveVisibleSequence(sequence, clips, sources, frameRate, true);
  if (!layout || issues.length) return false;
  const { spans, fades } = layout;
  const changed = fades.find(({ id }) => id === transitionId);
  if (!changed) return false;
  if (changed.kind === "dissolve") {
    return resolveDissolve(spans, fades, changed, sequence.durationFrames).conflict;
  }
  function visibleFadeSpans(fade: ResolvedFade) {
    const cut = transitionCut(fade);
    const start = fade.edge === "entry" ? cut : cut - fade.duration;
    const end = fade.edge === "entry" ? cut + fade.duration : cut;
    return spans.flatMap((span) =>
      span.placement === fade.placement && span.start < end && span.end > start
        ? [{ start: Math.max(span.start, start), end: Math.min(span.end, end) }]
        : [],
    );
  }
  const authoredSpans = visibleFadeSpans(changed);
  return (
    authoredSpans.length > 0 &&
    fades.some((other) => {
      if (other.id === transitionId) return false;
      if (other.kind === "dissolve") {
        return resolveDissolve(spans, [changed, other], other, sequence.durationFrames).conflict;
      }
      return visibleFadeSpans(other).some(
        (span) =>
          transitionCut(changed) === transitionCut(other) ||
          authoredSpans.some(({ start, end }) => start < span.end && end > span.start),
      );
    })
  );
}

function* getDissolveIssues(
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedFade[],
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
export function applyCutListTransitions(
  spans: readonly VisibleSpan[],
  fades: readonly ResolvedFade[],
  durationFrames: number,
) {
  return [
    ...getDissolveIssues(spans, fades, durationFrames),
    ...applyVisibleFades(spans, fades, durationFrames),
  ];
}
