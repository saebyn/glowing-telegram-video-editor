import { useMemo } from "react";
import { ProjectProvider } from "@/context/ProjectContext";
import type { FrameRate, SequenceSource } from "@/types";
import { frameThumbnailsInRange } from "@/utils/frameThumbnails";
import ProjectClipPool, { type ProjectClipPoolProps } from "./ProjectClipPool";

export type SequenceClipPoolProps = Pick<
  ProjectClipPoolProps,
  "clips" | "thumbnails" | "titles"
> & {
  sources?: readonly Pick<SequenceSource, "id" | "mediaKind" | "frameThumbnails">[];
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
  const keyframes = useMemo(() => {
    const sourcesById = new Map(sources?.map((source) => [source.id, source]));
    return Object.fromEntries(
      clips.map((clip) => [
        clip.id,
        frameThumbnailsInRange(sourcesById.get(clip.sourceId)?.frameThumbnails, clip).map(
          ({ url }) => url,
        ),
      ]),
    );
  }, [clips, sources]);

  return (
    <div onDragEnd={endClipDrag}>
      <ProjectProvider frameRate={frameRate}>
        <ProjectClipPool
          {...presentation}
          clips={clips}
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
