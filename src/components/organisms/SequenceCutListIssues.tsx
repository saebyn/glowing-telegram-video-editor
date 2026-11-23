import { useId } from "react";
import type { CutListIssue, FrameRate } from "@/types";

type Gap = Extract<CutListIssue, { code: "sequence-gap" }>;

function explainIssue(
  issue: CutListIssue,
  frameRate: FrameRate,
): { message: string; placementId?: string } | undefined {
  switch (issue.code) {
    case "empty-sequence":
      return { message: "The sequence has no output to compile." };
    case "invalid-sequence-duration":
      return { message: `Invalid sequence duration: ${issue.durationFrames} sequence frames.` };
    case "invalid-project-frame-rate":
      return { message: "The project frame rate must be a positive ratio of whole numbers." };
    case "missing-clip":
      return {
        message: `Missing clip metadata for ${issue.clipId} (placement ${issue.placementId}).`,
      };
    case "missing-source":
      return {
        message: `Missing source metadata for ${issue.sourceId}.`,
        placementId: issue.placementId,
      };
    case "frame-rate-mismatch":
      return {
        message: `Source frame rate ${issue.sourceFrameRate.numerator}/${issue.sourceFrameRate.denominator} does not match project frame rate ${frameRate.numerator}/${frameRate.denominator}.`,
        placementId: issue.placementId,
      };
    case "invalid-source-frame-rate":
      return { message: `Placement ${issue.placementId} has an invalid source frame rate.` };
    case "invalid-source-range":
      return {
        message: `Placement ${issue.placementId} has an invalid source range: ${issue.sourceInFrame} inclusive – ${issue.sourceOutFrame} exclusive.`,
      };
    case "placement-outside-sequence":
      return { message: `Placement ${issue.placementId} extends outside the sequence.` };
    case "track-overlap":
      return {
        message: `Placements ${issue.previousPlacementId} and ${issue.placementId} overlap on the same track.`,
      };
    case "invalid-transition":
      return { message: `Transition ${issue.transitionId} has an invalid kind or duration.` };
    default:
      // Gaps are grouped below. Keep the existing transition notices in the editing session.
      return undefined;
  }
}

export default function SequenceCutListIssues({
  issues,
  frameRate,
  onSeek,
  getInspection,
}: {
  issues: readonly CutListIssue[];
  frameRate: FrameRate;
  onSeek: (frame: number) => void;
  getInspection?: (placementId: string) => { label: string; inspect: () => void } | undefined;
}) {
  const headingId = useId();
  const gaps = issues.filter((issue): issue is Gap => issue.code === "sequence-gap");
  const problems = issues.flatMap((issue) => {
    const explanation = explainIssue(issue, frameRate);
    return explanation ? [explanation] : [];
  });
  if (!gaps.length && !problems.length) return null;

  const firstGapStart = gaps.reduce<number | undefined>(
    (first, { startFrame }) => (first === undefined ? startFrame : Math.min(first, startFrame)),
    undefined,
  );
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-1 text-sm text-amber-900 dark:text-amber-200"
    >
      <h2 id={headingId} className="font-semibold">
        CutList issues
      </h2>
      <p>CutList output is unavailable.</p>
      {problems.length > 0 && (
        <ul className="list-disc pl-5">
          {problems.map(({ message, placementId }) => {
            const inspection = placementId === undefined ? undefined : getInspection?.(placementId);
            return (
              <li key={`${placementId}:${message}`}>
                {message}{" "}
                {inspection && (
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={inspection.inspect}
                  >
                    Inspect {inspection.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {firstGapStart !== undefined && (
        <>
          <p>Gaps are valid in a sequence, but the current CutList cannot represent them.</p>
          <ul className="list-disc pl-5">
            {gaps.map(({ startFrame, endFrame }) => (
              <li key={`${startFrame}-${endFrame}`}>
                Sequence frames: {startFrame} inclusive – {endFrame} exclusive
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onSeek(firstGapStart)}
          >
            Jump to first gap
          </button>
        </>
      )}
    </section>
  );
}
