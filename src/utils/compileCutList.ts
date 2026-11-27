import type { CutList } from "@saebyn/glowing-telegram-types";
import type {
  CutListResult,
  CutListSource,
  FrameRate,
  Sequence,
  SourcesById,
  VideoClip,
} from "@/types";
import { applyCutListTransitions } from "./sequenceTransitions";
import { resolveVisibleSequence } from "./visibleSequence";

/** Compile fully covered edits at matching rates. */
export default function compileCutList(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<CutListSource>,
  frameRate: FrameRate,
): CutListResult {
  return analyzeSequence(sequence, clips, sources, frameRate).result;
}

/** Resolve the session duration and current export result from the same layout. */
export function analyzeSequence(
  sequence: Sequence,
  clips: readonly VideoClip[],
  sources: SourcesById<CutListSource>,
  frameRate: FrameRate,
) {
  const resolved = resolveVisibleSequence(sequence, clips, sources, frameRate);
  return {
    durationFrames: resolved.layout?.durationFrames ?? null,
    result: compileResolvedSequence(resolved),
  };
}

function compileResolvedSequence({
  issues,
  layout,
}: ReturnType<typeof resolveVisibleSequence>): CutListResult {
  if (layout) {
    for (const gap of layout.gaps) issues.push({ code: "sequence-gap", ...gap });
    issues.push(...applyCutListTransitions(layout));
  }
  const [issue, ...otherIssues] = issues;
  if (issue) return { ok: false, issues: [issue, ...otherIssues] };
  if (!layout?.spans.length) return { ok: false, issues: [{ code: "empty-sequence" }] };

  const inputMedia: CutList["inputMedia"] = [];
  const output = layout.spans.map(({ start, end, placement, transitionIn, transitionOut }) => {
    const { sourceInFrame, sequenceStartFrame } = placement;
    // Resolution reports any missing render reference before we construct the output.
    const s3Location = placement.s3Location!;
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
