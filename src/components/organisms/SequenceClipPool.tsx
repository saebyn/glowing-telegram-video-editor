import ProjectClipPool, { type ProjectClipPoolProps } from "./ProjectClipPool";

export type SequenceClipPoolProps = Pick<
  ProjectClipPoolProps,
  "clips" | "sources" | "thumbnails" | "keyframes" | "titles"
> & {
  beginClipDrag?: (clipId: string) => void;
  endClipDrag: () => void;
};

export default function SequenceClipPool({
  beginClipDrag,
  endClipDrag,
  ...presentation
}: SequenceClipPoolProps) {
  return (
    <div onDragEnd={endClipDrag}>
      <ProjectClipPool
        {...presentation}
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
    </div>
  );
}
