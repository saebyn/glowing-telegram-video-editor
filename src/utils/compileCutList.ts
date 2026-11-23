import type { CutList } from "@saebyn/glowing-telegram-types";
import type { CutListResult, FrameRate, Sequence, SequenceSource, VideoClip } from "@/types";
import { applyCutListTransitions } from "./sequenceTransitions";
import { resolveVisibleSequence } from "./visibleSequence";

/** Compile fully covered edits at matching rates. */
export default function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: readonly SequenceSource[],
  frameRate: FrameRate,
): CutListResult {
  const { issues, layout } = resolveVisibleSequence(sequence, clips, sources, frameRate);
  if (layout) {
    for (const gap of layout.gaps) issues.push({ code: "sequence-gap", ...gap });
    issues.push(...applyCutListTransitions(layout.spans, layout.fades, sequence.durationFrames));
  }
  const [issue, ...otherIssues] = issues;
  if (issue) return { ok: false, issues: [issue, ...otherIssues] };
  if (!layout?.spans.length) return { ok: false, issues: [{ code: "empty-sequence" }] };

  const inputMedia: CutList["inputMedia"] = [];
  const output = layout.spans.map(({ start, end, placement, transitionIn, transitionOut }) => {
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
  return {
    ok: true,
    cutList: { version: "1.0.0", inputMedia, outputTrack: [first, ...rest] },
    issues: [],
  };
}
