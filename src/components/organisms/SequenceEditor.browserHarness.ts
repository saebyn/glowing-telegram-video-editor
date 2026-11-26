import { expect, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { CutListResult, Sequence } from "@/types";

export const roughCutStoryId = "pages-sequenceeditorpage--assemble-a-rough-cut";
export const layeredEditStoryId = "pages-sequenceeditorpage--rearrange-a-layered-edit";
type Workflow = typeof roughCutStoryId | typeof layeredEditStoryId;
type SequenceArgs = Record<
  `sequence.${string}` | `projectRate.${string}`,
  string | number | undefined
> & {
  acceptEdits?: string;
  readOnly?: string;
  reviewEdits?: string;
  startWithoutTracks?: string;
  omitPreview?: string;
};

export async function openWorkflow(page: Page, story: Workflow, sequenceArgs: SequenceArgs = {}) {
  const query = new URLSearchParams({ id: story, viewMode: "story" });
  const args = Object.entries(sequenceArgs).map(
    ([key, value]) => `${key}:${value ?? "!undefined"}`,
  );
  if (args.length) query.set("args", args.join(";"));
  await page.goto(`/iframe.html?${query}`);
  // A cold Storybook dev server compiles the story after the iframe loads.
  await page
    .getByRole("region", { name: "Sequence editor", exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
}

// Use the rough-cut story's public args to create adjacent 120-frame placements
// for regressions that need a straight cut rather than the default gap.
export const straightCutArgs: SequenceArgs = {
  "sequence.tracks[0].placements[1].id": "lighthouse-next",
  "sequence.tracks[0].placements[1].clipId": "lighthouse",
  "sequence.tracks[0].placements[1].sequenceStartFrame": 120,
  "sequence.tracks[0].placements[1].sourceInOffsetFrames": undefined,
  "sequence.tracks[0].placements[1].sourceOutOffsetFrames": undefined,
};

// A real 60-frame placement anchors scenarios that need space after the action under test.
export function roughCutDepartureAt(sequenceStartFrame: number) {
  const placement = { id: "departure-tail", clipId: "departure", sequenceStartFrame };
  const args: SequenceArgs = {
    "sequence.tracks[0].placements[2].id": placement.id,
    "sequence.tracks[0].placements[2].clipId": placement.clipId,
    "sequence.tracks[0].placements[2].sequenceStartFrame": placement.sequenceStartFrame,
  };
  return { placement, args };
}

type Emissions = { sequences: Sequence[]; cutListResults: CutListResult[] };
type RecordingWindow = Window & { sequenceEditorEmissions?: Emissions };
export const noEdits: Emissions = { sequences: [], cutListResults: [] };

export function compiled(cutList: CutList): CutListResult {
  return { ok: true, cutList, issues: [] };
}

export const blockedOutput = {
  ok: false,
  issues: expect.arrayContaining([expect.objectContaining({ code: expect.any(String) })]),
};

export async function recordEditorEmissions(page: Page) {
  await page.addInitScript(() => {
    const emissions: Emissions = { sequences: [], cutListResults: [] };
    (window as RecordingWindow).sequenceEditorEmissions = emissions;
    window.addEventListener("sequence-editor:sequence-change", (event) => {
      emissions.sequences.push((event as CustomEvent<Sequence>).detail);
    });
    window.addEventListener("sequence-editor:cut-list-result", (event) => {
      emissions.cutListResults.push((event as CustomEvent<CutListResult>).detail);
    });
  });
  return () =>
    page.evaluate(() => {
      const emissions = (window as RecordingWindow).sequenceEditorEmissions;
      if (!emissions) throw new Error("Expected the editor's callback recorder");
      return emissions;
    });
}
