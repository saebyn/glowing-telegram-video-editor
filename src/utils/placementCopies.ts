import type {
  ClipPlacement,
  FrameRate,
  PlacementPastePreview,
  PlacementPasteTarget,
  Sequence,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange } from "./clipPlacements";
import { getProjectFrameCount } from "./frames";

type PastePlacement = PlacementPastePreview["placements"][number];
type PasteBlockReason = Extract<PlacementPastePreview, { kind: "blocked" }>["reason"];

export function copyPlacements(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementIds: readonly string[],
) {
  const selected = new Set(placementIds);
  const members = sequence.tracks.flatMap((track, trackIndex) =>
    track.placements
      .filter(({ id }) => selected.has(id))
      .flatMap((placement) => {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip) return [];
        const range = getPlacementSourceRange(clip, placement);
        return [
          {
            placement: {
              ...placement,
              ...(placement.transitionIn && { transitionIn: { ...placement.transitionIn } }),
              ...(placement.transitionOut && { transitionOut: { ...placement.transitionOut } }),
            },
            trackIndex,
            sourceId: clip.sourceId,
            range: { ...range, sourceFrameRate: { ...range.sourceFrameRate } },
            duration: getProjectFrameCount(range, frameRate),
          },
        ];
      }),
  );
  if (
    members.length === 0 ||
    members.length !== selected.size ||
    members.some(({ duration }) => !Number.isSafeInteger(duration) || duration <= 0)
  ) {
    return null;
  }
  return {
    members,
    firstTrackIndex: members[0].trackIndex,
    firstFrame: Math.min(...members.map(({ placement }) => placement.sequenceStartFrame)),
    lastEnd: Math.max(
      ...members.map(({ placement, duration }) => placement.sequenceStartFrame + duration),
    ),
  };
}

export type CopiedPlacements = NonNullable<ReturnType<typeof copyPlacements>>;

export function previewPlacementPaste(
  ...args: Parameters<typeof evaluatePaste>
): PlacementPastePreview {
  const { reason, proposals } = evaluatePaste(...args);
  const placements = proposals.map(({ preview }) => preview);
  return reason ? { kind: "blocked", reason, placements } : { kind: "valid", placements };
}

function evaluatePaste(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  copied: CopiedPlacements | null,
  target: PlacementPasteTarget,
) {
  const proposals: { placement: ClipPlacement; preview: PastePlacement }[] = [];
  const destinationIndex = sequence.tracks.findIndex(({ id }) => id === target.trackId);
  let reason: PasteBlockReason | undefined;
  if (destinationIndex < 0) return { proposals, reason: "outside-tracks" as const };
  if (!copied || !Number.isSafeInteger(target.sequenceFrame) || target.sequenceFrame < 0) {
    return { proposals, reason: "invalid-placement" as const };
  }
  for (const member of copied.members) {
    const { placement, range } = member;
    const clip = clips.find(({ id }) => id === placement.clipId);
    if (
      !clip ||
      clip.sourceId !== member.sourceId ||
      clip.sourceFrameRate.numerator * range.sourceFrameRate.denominator !==
        range.sourceFrameRate.numerator * clip.sourceFrameRate.denominator ||
      range.sourceInFrame < 0 ||
      range.sourceOutFrame > (clip.sourceDurationFrames ?? Infinity)
    ) {
      reason ??= "invalid-placement";
      continue;
    }
    const trackIndex = destinationIndex + (member.trackIndex - copied.firstTrackIndex);
    const track = sequence.tracks[trackIndex];
    if (!track) {
      reason ??= "outside-tracks";
      continue;
    }
    const sequenceStartFrame =
      target.sequenceFrame + (placement.sequenceStartFrame - copied.firstFrame);
    const duration = getProjectFrameCount(range, frameRate);
    const end = sequenceStartFrame + duration;
    if (!Number.isSafeInteger(end) || duration <= 0) {
      reason ??= "invalid-placement";
      continue;
    }
    if (track.locked) reason ??= "locked-track";
    if (
      proposals.some(
        ({ preview }) =>
          preview.trackId === track.id &&
          preview.sequenceStartFrame < end &&
          preview.sequenceStartFrame + preview.duration > sequenceStartFrame,
      )
    ) {
      reason ??= "overlap";
    }
    for (const other of track.placements) {
      if (other.sequenceStartFrame >= end) continue;
      const otherClip = clips.find(({ id }) => id === other.clipId);
      if (!otherClip) {
        reason ??= "invalid-placement";
        break;
      }
      const otherDuration = getProjectFrameCount(
        getPlacementSourceRange(otherClip, other),
        frameRate,
      );
      if (other.sequenceStartFrame + otherDuration > sequenceStartFrame) {
        reason ??= "overlap";
        break;
      }
    }
    const sourceInOffsetFrames = range.sourceInFrame - clip.sourceInFrame;
    const sourceOutOffsetFrames = range.sourceOutFrame - clip.sourceOutFrame;
    proposals.push({
      preview: { trackId: track.id, clipId: placement.clipId, sequenceStartFrame, duration },
      placement: {
        ...placement,
        sequenceStartFrame,
        ...(sourceInOffsetFrames !== 0 || placement.sourceInOffsetFrames !== undefined
          ? { sourceInOffsetFrames }
          : {}),
        ...(sourceOutOffsetFrames !== 0 || placement.sourceOutOffsetFrames !== undefined
          ? { sourceOutOffsetFrames }
          : {}),
      },
    });
  }
  return { proposals, reason };
}

export function pastePlacements(...args: Parameters<typeof evaluatePaste>): Sequence | null {
  const [sequence] = args;
  const { proposals, reason } = evaluatePaste(...args);
  if (reason) return null;
  const arrivals = new Map<string, ClipPlacement[]>();
  let durationFrames = sequence.durationFrames;
  for (const { placement, preview } of proposals) {
    const trackArrivals = arrivals.get(preview.trackId) ?? [];
    trackArrivals.push({
      ...placement,
      id: crypto.randomUUID(),
      ...(placement.transitionIn && {
        transitionIn: { ...placement.transitionIn, id: crypto.randomUUID() },
      }),
      ...(placement.transitionOut && {
        transitionOut: { ...placement.transitionOut, id: crypto.randomUUID() },
      }),
    });
    arrivals.set(preview.trackId, trackArrivals);
    durationFrames = Math.max(durationFrames, preview.sequenceStartFrame + preview.duration);
  }
  return {
    ...sequence,
    durationFrames,
    tracks: sequence.tracks.map((track) =>
      arrivals.has(track.id)
        ? { ...track, placements: [...track.placements, ...arrivals.get(track.id)!] }
        : track,
    ),
  };
}

export function duplicatePlacements(
  sequence: Sequence,
  clips: readonly VideoClip[],
  frameRate: FrameRate,
  placementIds: readonly string[],
): Sequence | null {
  const copied = copyPlacements(sequence, clips, frameRate, placementIds);
  if (!copied) return null;
  return pastePlacements(sequence, clips, frameRate, copied, {
    trackId: sequence.tracks[copied.firstTrackIndex].id,
    sequenceFrame: copied.lastEnd,
  });
}
