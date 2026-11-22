import type { CutList } from "@saebyn/glowing-telegram-types";
import type {
  ClipPlacement,
  FrameRate,
  MediaKind,
  Sequence,
  SequenceSource,
  VideoClip,
} from "@/types";
import { getDissolveWindow } from "./dissolveWindow";
import { getProjectFrameCount } from "./frames";

export function getPlacementSourceRange(clip: VideoClip, placement: ClipPlacement) {
  return {
    sourceInFrame: clip.sourceInFrame + (placement.sourceInOffsetFrames ?? 0),
    sourceOutFrame: clip.sourceOutFrame + (placement.sourceOutOffsetFrames ?? 0),
    sourceFrameRate: clip.sourceFrameRate,
  };
}

function inSequenceOrder(placements: readonly ClipPlacement[]) {
  return [...placements].sort((a, b) => a.sequenceStartFrame - b.sequenceStartFrame);
}

/** Find the exact position and length of a pool clip before allocating a placement ID. */
export function evaluatePoolDrop(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  clipId: string,
  trackId: string,
  atFrame: number,
) {
  const track = sequence.tracks.find(({ id }) => id === trackId);
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (!track || !clip || !Number.isSafeInteger(atFrame) || atFrame < 0) {
    return null;
  }

  const duration = getProjectFrameCount(clip, frameRate);
  let gapStart = 0;
  let gapEnd = Infinity;
  const placements = inSequenceOrder(track.placements);
  for (const placement of placements) {
    if (atFrame < placement.sequenceStartFrame) {
      gapEnd = placement.sequenceStartFrame;
      break;
    }
    const placedClip = clips.find((candidate) => candidate.id === placement.clipId);
    if (!placedClip) return null;
    const range = getPlacementSourceRange(placedClip, placement);
    gapStart = Math.max(
      gapStart,
      placement.sequenceStartFrame + getProjectFrameCount(range, frameRate),
    );
  }
  if (duration <= 0) return null;
  if (atFrame < gapStart) {
    return { kind: "blocked", reason: "overlap", sequenceStartFrame: atFrame, duration } as const;
  }
  if (gapEnd - gapStart < duration) {
    return {
      kind: "blocked",
      reason: "gap-too-short",
      sequenceStartFrame: atFrame,
      duration,
    } as const;
  }

  // Backfit only when a later placement bounds the gap.
  const sequenceStartFrame = Math.min(atFrame, gapEnd - duration);
  const endFrame = sequenceStartFrame + duration;
  if (!Number.isSafeInteger(endFrame)) return null;
  return { kind: "place", sequenceStartFrame, duration } as const;
}

/** Insert a clip into a bounded gap or extend the sequence after the last placement. */
export function placeClipInGap(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  clipId: string,
  trackId: string,
  atFrame: number,
): Sequence | null {
  const drop = evaluatePoolDrop(sequence, clips, frameRate, clipId, trackId, atFrame);
  if (drop?.kind !== "place") return null;
  const { sequenceStartFrame, duration } = drop;
  const placement: ClipPlacement = { id: crypto.randomUUID(), clipId, sequenceStartFrame };
  return {
    ...sequence,
    durationFrames: Math.max(sequence.durationFrames, sequenceStartFrame + duration),
    tracks: sequence.tracks.map((other) =>
      other.id === trackId ? { ...other, placements: [...other.placements, placement] } : other,
    ),
  };
}

/** Move a selection by the grabbed placement's frame and track offsets.
 * A numeric destination is a track index, possibly beyond the existing tracks.
 */
export function evaluatePlacementMove(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  grabbedId: string,
  destinationTrack: string | number | null,
  sequenceStartFrame: number,
  placementIds: readonly string[] = [grabbedId],
): PlacementMoveResult {
  const originIndex = sequence.tracks.findIndex((track) =>
    track.placements.some(({ id }) => id === grabbedId),
  );
  const matchingIndex = sequence.tracks.findIndex(({ id }) => id === destinationTrack);
  const destinationIndex =
    typeof destinationTrack === "number"
      ? destinationTrack
      : matchingIndex >= 0
        ? matchingIndex
        : null;
  const grabbed = sequence.tracks[originIndex]?.placements.find(({ id }) => id === grabbedId);
  const moving = new Set(placementIds);
  if (!grabbed || !moving.has(grabbedId) || !Number.isSafeInteger(sequenceStartFrame)) {
    return { kind: "blocked", reason: "invalid-placement", destinations: [] };
  }
  const trackShift = destinationIndex === null ? null : destinationIndex - originIndex;
  const frameOffset = sequenceStartFrame - grabbed.sequenceStartFrame;
  const moves = new Map<string, { placement: ClipPlacement; trackIndex: number | null }>();
  for (const [index, track] of sequence.tracks.entries()) {
    for (const placement of track.placements) {
      if (!moving.has(placement.id)) continue;
      const trackIndex = trackShift === null ? null : index + trackShift;
      moves.set(placement.id, {
        placement: { ...placement, sequenceStartFrame: placement.sequenceStartFrame + frameOffset },
        trackIndex,
      });
    }
  }
  const destinations = Array.from(moves, ([placementId, { placement, trackIndex }]) => ({
    placementId,
    trackIndex,
    sequenceStartFrame: placement.sequenceStartFrame,
  }));
  const block = (reason: PlacementMoveBlockReason, trackId?: string): PlacementMoveResult => ({
    kind: "blocked",
    reason,
    destinations,
    trackId,
  });
  if (moves.size !== moving.size) return block("invalid-placement");
  if (destinationIndex === null || !sequence.tracks[destinationIndex])
    return block("outside-tracks");
  if (trackShift === 0 && frameOffset === 0) return { kind: "unchanged", destinations };

  let durationFrames = sequence.durationFrames;
  const arrivals = sequence.tracks.map((): ClipPlacement[] => []);
  for (const { placement, trackIndex } of moves.values()) {
    if (trackIndex === null) return block("outside-tracks");
    const destination = sequence.tracks[trackIndex];
    if (!destination) return block("outside-tracks");
    const start = placement.sequenceStartFrame;
    if (start < 0) return block("negative-frame");
    const clip = clips.find(({ id }) => id === placement.clipId);
    if (!clip) return block("invalid-placement");
    const duration = getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate);
    const end = start + duration;
    if (duration <= 0 || !Number.isSafeInteger(end)) return block("invalid-placement");

    for (const other of destination.placements) {
      if (moving.has(other.id) || other.sequenceStartFrame >= end) continue;
      const otherClip = clips.find(({ id }) => id === other.clipId);
      if (!otherClip) return block("invalid-placement");
      const otherDuration = getProjectFrameCount(
        getPlacementSourceRange(otherClip, other),
        frameRate,
      );
      if (other.sequenceStartFrame + otherDuration > start) return block("overlap", destination.id);
    }
    durationFrames = Math.max(durationFrames, end);
    arrivals[trackIndex].push(placement);
  }

  return {
    kind: "move",
    destinations,
    sequence: {
      ...sequence,
      durationFrames,
      tracks: sequence.tracks.map((track, index) => ({
        ...track,
        placements:
          trackShift === 0
            ? track.placements.map((placement) => moves.get(placement.id)?.placement ?? placement)
            : [...track.placements.filter(({ id }) => !moving.has(id)), ...arrivals[index]],
      })),
    },
  };
}

type PlacementMoveDestination = {
  placementId: string;
  trackIndex: number | null;
  sequenceStartFrame: number;
};
type PlacementMoveBlockReason =
  | "outside-tracks"
  | "negative-frame"
  | "invalid-placement"
  | "overlap";
export type PlacementMoveResult = { destinations: PlacementMoveDestination[] } & (
  | { kind: "move"; sequence: Sequence }
  | { kind: "unchanged" }
  | { kind: "blocked"; reason: PlacementMoveBlockReason; trackId?: string }
);

type ResolvedPlacement = {
  trackIndex: number;
  sequenceStartFrame: number;
  sequenceEndFrame: number;
  sourceInFrame: number;
  knownSourceEnd: number;
  mediaKind?: MediaKind;
  s3Location: string;
};

type VisibleSpan = {
  start: number;
  end: number;
  placement: ResolvedPlacement;
  transitionIn?: CutList["outputTrack"][number]["transitionIn"];
  transitionOut?: CutList["outputTrack"][number]["transitionOut"];
};

type ResolvedFade = {
  id: string;
  kind: "fade" | "dissolve";
  placement: ResolvedPlacement;
  edge: "entry" | "reveal";
  duration: number;
};

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

function resolveVisibleSequence(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
  layoutOnly = false,
) {
  const boundaries: { frame: number; trackIndex: number; placement?: ResolvedPlacement }[] = [];
  const fades: ResolvedFade[] = [];
  for (const [trackIndex, track] of sequence.tracks.entries()) {
    let trackEndFrame = 0;
    for (const placement of inSequenceOrder(track.placements)) {
      const { sequenceStartFrame, entryTransition, revealTransition } = placement;
      if (sequenceStartFrame < trackEndFrame) return null;
      const clip = clips.find(({ id }) => id === placement.clipId);
      if (!clip) return null;
      const source = sources.find(({ id }) => id === clip.sourceId);
      const { sourceInFrame, sourceOutFrame, sourceFrameRate } = getPlacementSourceRange(
        clip,
        placement,
      );
      const frameCount = layoutOnly
        ? getProjectFrameCount({ sourceInFrame, sourceOutFrame, sourceFrameRate }, frameRate)
        : sourceOutFrame - sourceInFrame;
      const sequenceEndFrame = sequenceStartFrame + frameCount;
      if (
        (!layoutOnly &&
          (!source ||
            BigInt(sourceFrameRate.numerator) * BigInt(frameRate.denominator) !==
              BigInt(frameRate.numerator) * BigInt(sourceFrameRate.denominator))) ||
        frameCount <= 0 ||
        sourceInFrame < 0 ||
        sourceOutFrame <= sourceInFrame ||
        (clip.sourceDurationFrames !== undefined && sourceOutFrame > clip.sourceDurationFrames) ||
        !(sequenceEndFrame <= sequence.durationFrames)
      ) {
        return null;
      }
      const resolved = {
        trackIndex,
        sequenceStartFrame,
        sequenceEndFrame,
        sourceInFrame,
        knownSourceEnd: clip.sourceDurationFrames ?? Math.max(clip.sourceOutFrame, sourceOutFrame),
        mediaKind: source?.mediaKind,
        s3Location: source?.s3Location ?? clip.sourceId,
      };
      for (const [edge, transition] of [
        ["entry", entryTransition],
        ["reveal", revealTransition],
      ] as const) {
        if (!transition) continue;
        const duration = transition.durationFrames;
        if (
          (transition.kind !== "fade" && transition.kind !== "dissolve") ||
          !Number.isSafeInteger(duration) ||
          duration <= 0
        ) {
          return null;
        }
        fades.push({
          id: transition.id,
          kind: transition.kind,
          placement: resolved,
          edge,
          duration,
        });
      }

      boundaries.push(
        { frame: sequenceStartFrame, trackIndex, placement: resolved },
        { frame: sequenceEndFrame, trackIndex },
      );
      trackEndFrame = sequenceEndFrame;
    }
  }

  // Stable sorting preserves end-before-start order for adjacent placements on a track.
  boundaries.sort((a, b) => a.frame - b.frame);
  const active: (ResolvedPlacement | undefined)[] = sequence.tracks.map(() => undefined);
  let visible: ResolvedPlacement | undefined;
  let cutStartFrame = 0;
  let hasGap = false;
  const spans: VisibleSpan[] = [];
  for (const [index, { frame, trackIndex, placement }] of boundaries.entries()) {
    active[trackIndex] = placement;
    // Resolve priority after applying every change at this exclusive boundary.
    if (boundaries[index + 1]?.frame === frame) continue;
    const nextVisible = active.find((candidate) => candidate !== undefined);
    if (nextVisible === visible) continue;

    if (visible) spans.push({ start: cutStartFrame, end: frame, placement: visible });
    else if (frame > cutStartFrame) hasGap = true;
    visible = nextVisible;
    cutStartFrame = frame;
  }
  return { spans, fades, hasGap: hasGap || cutStartFrame !== sequence.durationFrames };
}

function applyVisibleFades(
  spans: readonly VisibleSpan[],
  fades: readonly ResolvedFade[],
  durationFrames: number,
) {
  let missingNeighbor = false;
  for (const { placement, edge, duration, kind } of fades) {
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
        missingNeighbor = true;
      }
      if (entry) first.transitionIn = { type: "fade", duration };
      else first.transitionOut = { type: "fade", duration };
      if (
        (first.transitionIn?.duration ?? 0) + (first.transitionOut?.duration ?? 0) >
        first.end - first.start
      ) {
        return "overlap";
      }
    } else {
      // A hidden edge is harmless only when higher tracks obscure the entire window.
      let coveredTo = Math.max(0, start);
      const visibleEnd = Math.min(durationFrames, end);
      for (let i = index; i < spans.length && spans[i].start < visibleEnd; i++) {
        const span = spans[i];
        if (span.start > coveredTo || span.placement.trackIndex >= placement.trackIndex) {
          return "interrupted";
        }
        coveredTo = span.end;
      }
      if (coveredTo < visibleEnd) return "interrupted";
    }
  }
  return missingNeighbor ? "gap" : null;
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
    if (
      !placement ||
      span.start > cursor ||
      span.placement.s3Location !== placement.s3Location ||
      sourceAt(span.placement, cursor) !== sourceAt(placement, cursor)
    )
      return false;
    cursor = span.end;
  }
  return !placement || cursor >= end;
}

function transitionCut({ edge, placement }: ResolvedFade) {
  return edge === "entry" ? placement.sequenceStartFrame : placement.sequenceEndFrame;
}

function dissolveDetails(
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
  function sourceExtension(side: ResolvedPlacement | undefined, start: number, end: number) {
    if (!side) return null;
    const startFrame = Math.max(0, sourceAt(side, start));
    const endFrame = Math.min(side.knownSourceEnd, sourceAt(side, end));
    return startFrame < endFrame ? { startFrame, endFrame } : null;
  }
  function missingContribution(side: ResolvedPlacement | undefined) {
    return {
      picture: !side || side.mediaKind === "audio-only",
      audio: !side || side.mediaKind === "video-only",
    };
  }
  return {
    ...window,
    cut,
    covered,
    interrupted,
    conflict,
    outgoingExtension: outgoing
      ? sourceExtension(outgoing, Math.max(cut, outgoing.sequenceEndFrame), window.endFrame)
      : null,
    incomingExtension: incoming
      ? sourceExtension(incoming, window.startFrame, Math.min(cut, incoming.sequenceStartFrame))
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
  const details = new Map<string, ReturnType<typeof dissolveDetails>>();
  if (
    !sequence.tracks.some(({ placements }) =>
      placements.some(
        ({ entryTransition, revealTransition }) =>
          entryTransition?.kind === "dissolve" || revealTransition?.kind === "dissolve",
      ),
    )
  )
    return details;
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (resolved) {
    for (const transition of resolved.fades) {
      if (transition.kind === "dissolve") {
        details.set(
          transition.id,
          dissolveDetails(resolved.spans, resolved.fades, transition, sequence.durationFrames),
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
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate, true);
  if (!resolved) return false;
  const { spans, fades } = resolved;
  const changed = fades.find(({ id }) => id === transitionId);
  if (!changed) return false;
  if (changed.kind === "dissolve") {
    return dissolveDetails(spans, fades, changed, sequence.durationFrames).conflict;
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
        return dissolveDetails(spans, [changed, other], other, sequence.durationFrames).conflict;
      }
      return visibleFadeSpans(other).some(
        (span) =>
          transitionCut(changed) === transitionCut(other) ||
          authoredSpans.some(({ start, end }) => start < span.end && end > span.start),
      );
    })
  );
}

function getDissolveIssue(
  spans: readonly VisibleSpan[],
  transitions: readonly ResolvedFade[],
  duration: number,
) {
  for (const transition of transitions) {
    if (transition.kind !== "dissolve") continue;
    const details = dissolveDetails(spans, transitions, transition, duration);
    if (!details.covered && details.startFrame < details.endFrame) {
      if (details.conflict) return "dissolve-conflict";
      if (details.interrupted) return "dissolve-interrupted";
      if (details.missingIncoming || details.missingOutgoing) return "dissolve-gap";
      return "dissolve";
    }
  }
  return null;
}

/** Transition-specific output feedback, independent of gaps elsewhere in the sequence. */
export function getFadeOutputIssue(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
) {
  if (
    !sequence.tracks.some(({ placements }) =>
      placements.some(
        ({ entryTransition, revealTransition }) => entryTransition || revealTransition,
      ),
    )
  )
    return null;
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate);
  return resolved
    ? (getDissolveIssue(resolved.spans, resolved.fades, sequence.durationFrames) ??
        applyVisibleFades(resolved.spans, resolved.fades, sequence.durationFrames))
    : null;
}

/** Compile fully covered edits at matching rates. */
export function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
): CutList | null {
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (!resolved || !resolved.spans.length || resolved.hasGap) return null;
  const { spans, fades } = resolved;
  if (
    getDissolveIssue(spans, fades, sequence.durationFrames) ||
    applyVisibleFades(spans, fades, sequence.durationFrames)
  )
    return null;

  const inputMedia: CutList["inputMedia"] = [];
  const output = spans.map(({ start, end, placement, transitionIn, transitionOut }) => {
    const { s3Location, sourceInFrame, sequenceStartFrame } = placement;
    let mediaIndex = inputMedia.findIndex((media) => media.s3Location === s3Location);
    if (mediaIndex === -1) {
      mediaIndex = inputMedia.length;
      inputMedia.push({ s3Location, sections: [] });
    }
    const { sections } = inputMedia[mediaIndex];
    const sectionIndex = sections.length;
    sections.push({
      startFrame: sourceInFrame + (start - sequenceStartFrame),
      endFrame: sourceInFrame + (end - sequenceStartFrame),
    });
    return {
      mediaIndex,
      sectionIndex,
      ...(transitionIn && { transitionIn }),
      ...(transitionOut && { transitionOut }),
    };
  });
  const [first, ...rest] = output;
  return { version: "1.0.0", inputMedia, outputTrack: [first, ...rest] };
}
