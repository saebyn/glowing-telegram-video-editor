import type {
  FrameRate,
  MediaKind,
  Sequence,
  SequenceSource,
  SourcesById,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange } from "./clipPlacements";
import { getDissolveWindow } from "./dissolveWindow";
import { framesToSeconds, getProjectFrameCount, isValidFrameRate } from "./frames";
import { getSource } from "./sourcesById";

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

export function createSequencePresentation(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<SequenceSource>,
  frameRate: FrameRate,
): (frame: number, kinds?: ReadonlyMap<string, MediaKind>, audible?: boolean) => PreviewFrame {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const frameSeconds = framesToSeconds(1, frameRate);
  const placements = sequence.tracks.flatMap(({ placements }, track) =>
    placements.flatMap((placement) => {
      const clip = byId.get(placement.clipId);
      if (!clip || !isValidFrameRate(clip.sourceFrameRate)) return [];
      const range = getPlacementSourceRange(clip, placement);
      return {
        sourceId: clip.sourceId,
        track,
        mediaKind: getSource(sources, clip.sourceId)?.mediaKind,
        transitionIn: placement.transitionIn,
        transitionOut: placement.transitionOut,
        start: placement.sequenceStartFrame,
        end: placement.sequenceStartFrame + getProjectFrameCount(range, frameRate),
        sourceIn: framesToSeconds(range.sourceInFrame, range.sourceFrameRate),
        sourceOut: framesToSeconds(range.sourceOutFrame, range.sourceFrameRate),
        recordedEnd:
          clip.sourceDurationFrames === undefined
            ? Infinity
            : framesToSeconds(clip.sourceDurationFrames, range.sourceFrameRate),
      };
    }),
  );
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
  const transitions = placements.flatMap((owner) =>
    [owner.transitionIn, owner.transitionOut].flatMap((transition, edge) => {
      if (!transition || transition.durationFrames <= 0) return [];
      const leading = edge === 0;
      const cut = leading ? owner.start : owner.end;
      const duration = transition.durationFrames;
      const { startFrame, endFrame, phaseOffsetFrames } =
        transition.kind === "dissolve"
          ? getDissolveWindow(cut, duration, sequence.durationFrames)
          : {
              startFrame: leading ? cut : cut - duration,
              endFrame: leading ? cut + duration : cut,
              phaseOffsetFrames: 0,
            };
      return {
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
    }),
  );
  const boundaries = [...new Set(placements.flatMap(({ start, end }) => [start, end]))].sort(
    (a, b) => a - b,
  );
  return (frame, kinds, audible = true) => {
    const probes = new Set<string>();
    function winner(frame: number, channel: "picture" | "sound") {
      return placements.find(({ start, end, mediaKind, sourceId }) => {
        if (frame < 0 || frame >= sequence.durationFrames || start > frame || frame >= end)
          return false;
        const kind = mediaKind ?? kinds?.get(sourceId);
        if (!kind) probes.add(sourceId);
        return kind !== (channel === "picture" ? "audio-only" : "video-only");
      });
    }
    const continuous = (
      channel: "picture" | "sound",
      expected: Placement | undefined,
      from: number,
      to: number,
      ownerTrack: number,
    ) =>
      from >= to ||
      [from, ...boundaries.filter((frame) => from < frame && frame < to)].every((frame) => {
        const visible = winner(frame, channel);
        return (
          visible === expected ||
          (!!visible && visible.track < (expected?.track ?? ownerTrack)) ||
          (!!visible && !!expected && sameSourceTime(visible, expected))
        );
      });
    let problem: PreviewFrame["problem"];
    const sample = (
      placement: Placement | undefined,
      channel: "picture" | "sound",
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
    const resolve = (channel: "picture" | "sound") => {
      const visible = winner(frame, channel);
      const active = transitions.filter(
        ({ owner, fadeTrim, leading, cut, kind, startFrame, endFrame }) => {
          if (startFrame > frame || frame >= endFrame) return false;
          const atAnchor = owner === winner(leading ? cut : cut - 1, channel);
          if (kind === "fade") {
            const outsideTrim = frame < fadeTrim.start || frame >= fadeTrim.end;
            if (owner === visible) return true;
            if (!outsideTrim)
              return visible?.track === owner.track && sameSourceTime(visible, owner);
            return atAnchor && (!visible || visible.track >= owner.track);
          }
          const side = winner(frame < cut ? cut - 1 : cut, channel);
          return atAnchor && (!visible || visible.track >= (side?.track ?? owner.track));
        },
      );
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
      const outgoing = kind === "fade" && !leading ? fadeTrim : winner(cut - 1, channel);
      const incoming = kind === "fade" && leading ? fadeTrim : winner(cut, channel);
      const sameCut = transitions.some(
        (other) =>
          other !== transition &&
          other.cut === cut &&
          other.owner === winner(other.leading ? cut : cut - 1, channel),
      );
      const fadeInterrupted =
        kind === "fade" &&
        (!continuous(
          channel,
          owner,
          Math.max(0, startFrame, fadeTrim.start),
          Math.min(endFrame, fadeTrim.end, sequence.durationFrames),
          owner.track,
        ) ||
          !continuous(
            channel,
            leading ? outgoing : incoming,
            leading ? fadeTrim.end : Math.max(0, startFrame),
            leading ? Math.min(endFrame, sequence.durationFrames) : fadeTrim.start,
            owner.track,
          ));
      if (
        active.length > 1 ||
        sameCut ||
        fadeInterrupted ||
        (kind === "dissolve" &&
          (!continuous(channel, outgoing, startFrame, cut, owner.track) ||
            !continuous(channel, incoming, cut, endFrame, owner.track)))
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
  };
}
