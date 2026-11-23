import type { CutList } from "@saebyn/glowing-telegram-types";
import type { FrameRate, Sequence, SequenceSource, VideoClip } from "@/types";
import { applyCutListTransitions } from "./sequenceTransitions";
import { resolveVisibleSequence } from "./visibleSequence";

/** Compile fully covered edits at matching rates. */
export default function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
): CutList | null {
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (!resolved || !resolved.spans.length || resolved.hasGap) return null;
  const { spans, fades } = resolved;
  if (applyCutListTransitions(spans, fades, sequence.durationFrames)) return null;

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
