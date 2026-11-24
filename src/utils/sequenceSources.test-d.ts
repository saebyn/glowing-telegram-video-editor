import { expectTypeOf } from "vitest";
import type { ComponentProps } from "react";
import type {
  compileCutList,
  CutListSource,
  ProjectClipPool,
  SequenceClipPool,
  SequenceEditorPageProps,
  SequenceSource,
  SequenceTimeline,
  UseSequenceEditorOptions,
} from "@/index";

type SparseRecord<T> = Readonly<Partial<Record<string, T>>>;
expectTypeOf<CutListSource>().toEqualTypeOf<{ s3Location: string }>();
expectTypeOf<"id">().not.toExtend<keyof SequenceSource>();
expectTypeOf<Parameters<typeof compileCutList>[2]>().toEqualTypeOf<SparseRecord<CutListSource>>();

type WithRendition = { previewHlsUrl: string };
type VideoOnly = CutListSource & { mediaKind: "video-only" };
type AudioVideo = CutListSource & { mediaKind: "audio-video" };
type AudioOnly = CutListSource & { mediaKind: "audio-only" };

expectTypeOf<CutListSource & WithRendition>().toExtend<SequenceSource>();
expectTypeOf<VideoOnly & WithRendition>().toExtend<SequenceSource>();
expectTypeOf<AudioVideo & WithRendition>().toExtend<SequenceSource>();
expectTypeOf<CutListSource>().not.toExtend<SequenceSource>();
expectTypeOf<VideoOnly>().not.toExtend<SequenceSource>();
expectTypeOf<AudioVideo>().not.toExtend<SequenceSource>();
expectTypeOf<CutListSource & { previewHlsUrl: number }>().not.toExtend<SequenceSource>();
expectTypeOf<AudioOnly>().toExtend<SequenceSource>();

type EditorSources = SparseRecord<SequenceSource>;
type TimelineSources = ComponentProps<typeof SequenceTimeline>["sources"];
type SequencePoolSources = ComponentProps<typeof SequenceClipPool>["sources"];
type ProjectPoolSources = ComponentProps<typeof ProjectClipPool>["sources"];

expectTypeOf<SequenceEditorPageProps["sources"]>().toEqualTypeOf<EditorSources>();
expectTypeOf<UseSequenceEditorOptions["sources"]>().toEqualTypeOf<EditorSources>();
expectTypeOf<TimelineSources>().toEqualTypeOf<EditorSources>();
expectTypeOf<SequencePoolSources>().toEqualTypeOf<
  SparseRecord<Pick<SequenceSource, "mediaKind" | "frameThumbnails">> | undefined
>();
expectTypeOf<ProjectPoolSources>().toEqualTypeOf<
  SparseRecord<Pick<SequenceSource, "mediaKind">> | undefined
>();
expectTypeOf<EditorSources>().toExtend<Parameters<typeof compileCutList>[2]>();
expectTypeOf<readonly CutListSource[]>().not.toExtend<Parameters<typeof compileCutList>[2]>();
expectTypeOf<readonly SequenceSource[]>().not.toExtend<SequenceEditorPageProps["sources"]>();
expectTypeOf<readonly SequenceSource[]>().not.toExtend<UseSequenceEditorOptions["sources"]>();
expectTypeOf<readonly SequenceSource[]>().not.toExtend<TimelineSources>();
expectTypeOf<readonly Pick<SequenceSource, "mediaKind">[]>().not.toExtend<ProjectPoolSources>();
expectTypeOf<
  readonly Pick<SequenceSource, "mediaKind" | "frameThumbnails">[]
>().not.toExtend<SequencePoolSources>();
