import type { SequenceSource, SourceRange } from "@/types";

export function frameThumbnailsInRange(
  thumbnails: SequenceSource["frameThumbnails"],
  { sourceInFrame, sourceOutFrame }: Pick<SourceRange, "sourceInFrame" | "sourceOutFrame">,
) {
  return (
    thumbnails
      ?.filter(({ sourceFrame }) => sourceFrame >= sourceInFrame && sourceFrame < sourceOutFrame)
      .sort((first, second) => first.sourceFrame - second.sourceFrame) ?? []
  );
}
