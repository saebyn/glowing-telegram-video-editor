import { expectTypeOf } from "vitest";
import type {
  compileCutList,
  CutListSource,
  SequenceEditorPageProps,
  SequenceSource,
  UseSequenceEditorOptions,
} from "@/index";

expectTypeOf<CutListSource>().toEqualTypeOf<{ id: string; s3Location: string }>();
expectTypeOf<Parameters<typeof compileCutList>[2]>().toEqualTypeOf<readonly CutListSource[]>();

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

expectTypeOf<SequenceEditorPageProps["sources"]>().toEqualTypeOf<readonly SequenceSource[]>();
expectTypeOf<UseSequenceEditorOptions["sources"]>().toEqualTypeOf<readonly SequenceSource[]>();
expectTypeOf<readonly SequenceSource[]>().toExtend<Parameters<typeof compileCutList>[2]>();
