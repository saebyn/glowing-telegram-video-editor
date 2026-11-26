import type { CutListIssue, SequenceInputIssue } from "@/types";

export function getSequenceInputIssues(issues: readonly CutListIssue[]): SequenceInputIssue[] {
  return issues.filter((issue): issue is SequenceInputIssue => {
    switch (issue.code) {
      case "invalid-sequence-duration":
      case "invalid-project-frame-rate":
      case "missing-clip":
      case "invalid-source-frame-rate":
      case "invalid-source-range":
      case "placement-outside-sequence":
      case "track-overlap":
        return true;
      default:
        return false;
    }
  });
}

/** Compare diagnostic sets, not host object identity, property order or traversal order. */
export function sequenceInputIssueKey(issues: readonly SequenceInputIssue[]): string {
  const keys = issues.map((issue) => {
    const rate =
      issue.code === "invalid-project-frame-rate"
        ? issue.frameRate
        : issue.code === "invalid-source-frame-rate"
          ? issue.sourceFrameRate
          : undefined;
    const fields = rate
      ? [
          issue.code,
          "placementId" in issue ? issue.placementId : null,
          rate.numerator,
          rate.denominator,
        ]
      : issue;
    return JSON.stringify(fields, (_key, value: unknown) =>
      typeof value === "number" && !Number.isFinite(value) ? String(value) : value,
    );
  });
  return JSON.stringify([...new Set(keys)].sort());
}
