import { useMemo } from "react";
import { ProjectProvider } from "@/context/ProjectContext";
import type { FrameRate, SequenceSource, SourcesById } from "@/types";
import { isValidSourceRange } from "@/utils/clipPlacements";
import { frameThumbnailsInRange } from "@/utils/frameThumbnails";
import { isValidFrameRate } from "@/utils/frames";
import { getSource } from "@/utils/sourcesById";
import ProjectClipPool, { type ProjectClipPoolProps } from "./ProjectClipPool";

export type SequenceClipPoolProps = Pick<
  ProjectClipPoolProps,
  "clips" | "thumbnails" | "titles"
> & {
  sources?: SourcesById<Pick<SequenceSource, "mediaKind" | "frameThumbnails">>;
  frameRate: FrameRate;
  beginClipDrag?: (clipId: string) => void;
  endClipDrag: () => void;
};

export default function SequenceClipPool({
  beginClipDrag,
  endClipDrag,
  frameRate,
  clips,
  sources,
  ...presentation
}: SequenceClipPoolProps) {
  const usableClips = useMemo(
    () =>
      isValidFrameRate(frameRate)
        ? clips.filter(
            (clip) =>
              isValidFrameRate(clip.sourceFrameRate) &&
              isValidSourceRange(clip, clip.sourceDurationFrames),
          )
        : [],
    [clips, frameRate],
  );
  const keyframes = useMemo(() => {
    return Object.fromEntries(
      usableClips.map((clip) => [
        clip.id,
        frameThumbnailsInRange(getSource(sources, clip.sourceId)?.frameThumbnails, clip).map(
          ({ url }) => url,
        ),
      ]),
    );
  }, [usableClips, sources]);

  return (
    <div onDragEnd={endClipDrag}>
      <ProjectProvider frameRate={frameRate}>
        <ProjectClipPool
          {...presentation}
          clips={usableClips}
          sources={sources}
          keyframes={keyframes}
          clipWidth="136px"
          clipHeight="76px"
          onDragStart={
            beginClipDrag
              ? (ids) => {
                  if (ids.length === 1) beginClipDrag(ids[0]);
                  else endClipDrag();
                }
              : undefined
          }
        />
      </ProjectProvider>
    </div>
  );
}
