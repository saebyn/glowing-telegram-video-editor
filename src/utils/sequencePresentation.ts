import type {
  FrameRate,
  MediaKind,
  Sequence,
  SequenceSource,
  SourcesById,
  VideoClip,
} from "@/types";
import { getDissolveWindow } from "./dissolveWindow";
import { framesToSeconds } from "./frames";
import { getSource } from "./sourcesById";
import { resolveSequencePlacements } from "./visibleSequence";

export interface PreviewSample {
  sourceId: string;
  time: number;
  weight: number;
  endWeight?: number;
  /** Limit a sound block to recorded material if the source ends during the frame. */
  length?: number;
  /** Sequence-frame seconds before the recording starts. */
  delay?: number;
  extension?: true;
}

interface PreviewFrame {
  picture: PreviewSample[];
  sound: PreviewSample[];
  problem?: "undefined-transition";
  probes?: string[];
}

type Channel = "picture" | "sound";

function resolveContributions(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
) {
  const { geometry } = resolveSequencePlacements(sequence, clips, sources, frameRate, true);
  if (!geometry) return null;
  const { durationFrames } = geometry;
  const byPlacement = new Map(
    geometry.placements.map((placement) => {
      const { sourceId, sourceFrameRate, sourceInFrame, sourceOutFrame, sourceDurationFrames } =
        placement;
      return [
        placement,
        {
          sourceId,
          track: placement.trackIndex,
          mediaKind: getSource(sources, sourceId)?.mediaKind,
          start: placement.sequenceStartFrame,
          end: placement.sequenceEndFrame,
          sourceIn: framesToSeconds(sourceInFrame, sourceFrameRate),
          sourceOut: framesToSeconds(sourceOutFrame, sourceFrameRate),
          recordedEnd:
            sourceDurationFrames === undefined
              ? Infinity
              : framesToSeconds(sourceDurationFrames, sourceFrameRate),
        },
      ];
    }),
  );
  const placements = [...byPlacement.values()];
  type Placement = (typeof placements)[number];
  const offset = (placement: Placement) =>
    placement.sourceIn - framesToSeconds(placement.start, frameRate);
  const sameSourceTime = (a: Placement, b: Placement) =>
    a.sourceId === b.sourceId && Math.abs(offset(a) - offset(b)) < 1e-8;
  function getFadeTrim(
    owner: Placement,
    leading: boolean,
    startFrame: number,
    endFrame: number,
  ): Placement {
    let edge = owner;
    // A source-continuous split widens the in-trim material, not the fade window.
    while (leading ? edge.end < endFrame : edge.start > startFrame) {
      const next = placements.find(
        (placement) =>
          placement.track === owner.track &&
          (leading ? placement.start === edge.end : placement.end === edge.start) &&
          placement.end > placement.start &&
          sameSourceTime(placement, owner),
      );
      if (!next) break;
      edge = next;
    }
    if (edge === owner) return owner;
    return leading
      ? { ...owner, end: edge.end, sourceOut: edge.sourceOut }
      : { ...owner, start: edge.start, sourceIn: edge.sourceIn };
  }
  const transitions = geometry.transitions.map((transition) => {
    const owner = byPlacement.get(transition.placement)!;
    const leading = transition.edge === "leading";
    const cut = leading ? owner.start : owner.end;
    const duration = transition.durationFrames;
    const { startFrame, endFrame, phaseOffsetFrames } =
      transition.kind === "dissolve"
        ? getDissolveWindow(cut, duration, durationFrames)
        : {
            startFrame: leading ? cut : cut - duration,
            endFrame: leading ? cut + duration : cut,
            phaseOffsetFrames: 0,
          };
    return {
      id: transition.id,
      owner,
      fadeTrim:
        transition.kind === "fade" ? getFadeTrim(owner, leading, startFrame, endFrame) : owner,
      leading,
      cut,
      duration,
      startFrame,
      endFrame,
      phaseOffsetFrames,
      kind: transition.kind,
    };
  });
  const boundaries = [...new Set(placements.flatMap(({ start, end }) => [start, end]))].sort(
    (a, b) => a - b,
  );
  type Transition = (typeof transitions)[number];
  function forChannel(
    channel: Channel,
    kinds?: ReadonlyMap<string, MediaKind>,
    probe?: (sourceId: string) => void,
  ) {
    function winner(frame: number) {
      if (frame < 0 || frame >= durationFrames) return undefined;
      return placements.find(({ start, end, mediaKind, sourceId }) => {
        if (start > frame || frame >= end) return false;
        const kind = mediaKind ?? kinds?.get(sourceId);
        if (!kind) probe?.(sourceId);
        return kind !== (channel === "picture" ? "audio-only" : "video-only");
      });
    }
    function atAnchor({ owner, leading, cut }: Transition) {
      return owner === winner(leading ? cut : cut - 1);
    }
    function isActive(transition: Transition, frame: number, visible: Placement | undefined) {
      const { owner, fadeTrim, cut, kind, startFrame, endFrame } = transition;
      if (startFrame > frame || frame >= endFrame) return false;
      const anchored = atAnchor(transition);
      if (kind === "fade") {
        if (owner === visible) return true;
        if (fadeTrim.start <= frame && frame < fadeTrim.end)
          return visible?.track === owner.track && sameSourceTime(visible, owner);
        return anchored && (!visible || visible.track >= owner.track);
      }
      const side = winner(frame < cut ? cut - 1 : cut);
      return anchored && (!visible || visible.track >= (side?.track ?? owner.track));
    }
    function claimsSameCut(claimant: Transition, active: Transition) {
      return claimant !== active && claimant.cut === active.cut && atAnchor(claimant);
    }
    return { winner, isActive, claimsSameCut };
  }
  return { durationFrames, transitions, boundaries, sameSourceTime, forChannel };
}

export function createSequencePresentation(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
) {
  const contributions = resolveContributions(sequence, clips, sources, frameRate);
  if (!contributions)
    return { durationFrames: null, at: (): PreviewFrame => ({ picture: [], sound: [] }) };
  const { durationFrames, transitions, boundaries, sameSourceTime, forChannel } = contributions;
  type Placement = (typeof transitions)[number]["owner"];
  const frameSeconds = framesToSeconds(1, frameRate);
  function at(frame: number, kinds?: ReadonlyMap<string, MediaKind>, audible = true): PreviewFrame {
    const probes = new Set<string>();
    let problem: PreviewFrame["problem"];
    const sample = (
      placement: Placement | undefined,
      channel: Channel,
      weight: number,
      endWeight?: number,
    ): PreviewSample[] => {
      if (!placement) return [];
      const time = placement.sourceIn + framesToSeconds(frame - placement.start, frameRate);
      const transition = endWeight !== undefined || weight !== 1;
      const limit = !transition
        ? Math.min(placement.sourceOut, placement.recordedEnd)
        : placement.recordedEnd;
      const delay = Math.max(0, -time);
      if (
        (channel === "picture" && delay > 1e-9) ||
        delay >= frameSeconds - 1e-9 ||
        time >= limit - 1e-9
      )
        return [];
      const length = Math.min(frameSeconds - delay, limit - Math.max(time, 0));
      const extension =
        transition &&
        (time < placement.sourceIn - 1e-9 ||
          (channel === "picture"
            ? time >= placement.sourceOut - 1e-9
            : time + delay + length > placement.sourceOut + 1e-9));
      return [
        {
          sourceId: placement.sourceId,
          time: Math.max(0, time),
          weight,
          ...(endWeight === undefined ? {} : { endWeight }),
          ...(channel === "sound" && length < frameSeconds - 1e-9 ? { length } : {}),
          ...(delay > 1e-9 ? { delay } : {}),
          ...(extension ? { extension: true } : {}),
        },
      ];
    };
    const resolve = (channel: Channel) => {
      const { winner, isActive, claimsSameCut } = forChannel(channel, kinds, (id) =>
        probes.add(id),
      );
      const visible = winner(frame);
      const active = transitions.filter((transition) => isActive(transition, frame, visible));
      const transition = active[0];
      if (!transition) return sample(visible, channel, 1);
      const {
        owner,
        fadeTrim,
        leading,
        cut,
        kind,
        startFrame,
        endFrame,
        phaseOffsetFrames,
        duration,
      } = transition;
      const outgoing = kind === "fade" && !leading ? fadeTrim : winner(cut - 1);
      const incoming = kind === "fade" && leading ? fadeTrim : winner(cut);
      const sameCut = transitions.some((other) => claimsSameCut(other, transition));
      const continuous = (
        expected: Placement | undefined,
        from: number,
        to: number,
        ownerTrack: number,
      ) =>
        from >= to ||
        [from, ...boundaries.filter((frame) => from < frame && frame < to)].every((frame) => {
          const visible = winner(frame);
          return (
            visible === expected ||
            (!!visible && visible.track < (expected?.track ?? ownerTrack)) ||
            (!!visible && !!expected && sameSourceTime(visible, expected))
          );
        });
      const fadeInterrupted =
        kind === "fade" &&
        (!continuous(
          owner,
          Math.max(0, startFrame, fadeTrim.start),
          Math.min(endFrame, fadeTrim.end, durationFrames),
          owner.track,
        ) ||
          !continuous(
            leading ? outgoing : incoming,
            leading ? fadeTrim.end : Math.max(0, startFrame),
            leading ? Math.min(endFrame, durationFrames) : fadeTrim.start,
            owner.track,
          ));
      if (
        active.length > 1 ||
        sameCut ||
        fadeInterrupted ||
        (kind === "dissolve" &&
          (!continuous(outgoing, startFrame, cut, owner.track) ||
            !continuous(incoming, cut, endFrame, owner.track)))
      ) {
        problem = "undefined-transition";
        return [];
      }
      const elapsed = frame - startFrame + phaseOffsetFrames;
      const phase = (elapsed + (channel === "picture" ? 0.5 : 0)) / duration;
      const next = channel === "sound" ? (elapsed + 1) / duration : undefined;
      return [
        ...sample(outgoing, channel, 1 - phase, next === undefined ? undefined : 1 - next),
        ...sample(incoming, channel, phase, next),
      ];
    };
    const picture = resolve("picture");
    const sound = audible ? resolve("sound") : [];
    return {
      picture,
      sound,
      ...(problem ? { problem } : {}),
      ...(probes.size ? { probes: [...probes] } : {}),
    };
  }
  return { durationFrames, at };
}

/** Authoring checks the proposed transition's competition independently of export and playback errors. */
export function hasPresentationTransitionConflict(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
  transitionId: string,
) {
  const contributions = resolveContributions(sequence, clips, sources, frameRate);
  if (!contributions) return false;
  const { durationFrames, transitions, boundaries, forChannel } = contributions;
  const changed = transitions.find(({ id }) => id === transitionId);
  if (!changed) return false;

  // Without probed media kinds, an unspecified source can contribute to either channel.
  return (["picture", "sound"] as const).some((channel) => {
    const { winner, isActive, claimsSameCut } = forChannel(channel);
    function withinWindow(start: number, end: number, check: (frame: number) => boolean) {
      start = Math.max(0, start);
      end = Math.min(end, durationFrames);
      if (start >= end) return false;
      // The first frame accounts for the transition window. Inside it activity can change
      // only at placement boundaries, which include both transitions' cuts and fade trim edges.
      return (
        check(start) || boundaries.some((frame) => start < frame && frame < end && check(frame))
      );
    }
    const contributes = (transition: typeof changed) =>
      withinWindow(transition.startFrame, transition.endFrame, (frame) =>
        isActive(transition, frame, winner(frame)),
      );
    return transitions.some((other) => {
      if (other === changed) return false;
      // Either transition can claim the same cut as the other's active contribution,
      // even when their windows don't overlap.
      if (
        (claimsSameCut(other, changed) && contributes(changed)) ||
        (claimsSameCut(changed, other) && contributes(other))
      )
        return true;
      return withinWindow(
        Math.max(changed.startFrame, other.startFrame),
        Math.min(changed.endFrame, other.endFrame),
        (frame) => {
          const visible = winner(frame);
          return isActive(changed, frame, visible) && isActive(other, frame, visible);
        },
      );
    });
  });
}
