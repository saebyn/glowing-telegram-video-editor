import { expectTypeOf } from "vitest";
import type {
  ClipPlacement,
  compileCutList,
  PlacementTransition,
  SequenceEditorPageProps,
  SequenceTimelineProps,
} from "@/index";

type EditorInput = SequenceEditorPageProps["sequence"]["tracks"][number]["placements"][number];
type EditorOutputSequence = Parameters<NonNullable<SequenceEditorPageProps["onSequenceChange"]>>[0];
type EditorOutput = EditorOutputSequence["tracks"][number]["placements"][number];
type CompilerInput = Parameters<typeof compileCutList>[0]["tracks"][number]["placements"][number];
type TimelineInput = SequenceTimelineProps["tracks"][number]["placements"][number];

expectTypeOf<EditorInput>().toEqualTypeOf<ClipPlacement>();
expectTypeOf<EditorOutput>().toEqualTypeOf<ClipPlacement>();
expectTypeOf<CompilerInput>().toEqualTypeOf<ClipPlacement>();
expectTypeOf<TimelineInput>().toEqualTypeOf<ClipPlacement>();
expectTypeOf<ClipPlacement>()
  .toHaveProperty("transitionIn")
  .toEqualTypeOf<PlacementTransition | undefined>();
expectTypeOf<ClipPlacement>()
  .toHaveProperty("transitionOut")
  .toEqualTypeOf<PlacementTransition | undefined>();
expectTypeOf<Extract<keyof ClipPlacement, "entryTransition" | "revealTransition">>().toBeNever();
