import type { Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";

export const roughCutStoryId = "pages-sequenceeditorpage--assemble-a-rough-cut";
export const layeredEditStoryId = "pages-sequenceeditorpage--rearrange-a-layered-edit";
type Workflow = typeof roughCutStoryId | typeof layeredEditStoryId;
type SequenceArgs = Record<`sequence.${string}`, string | number | undefined> & {
  acceptEdits?: string;
  readOnly?: string;
  startWithoutTracks?: string;
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
  "sequence.durationFrames": 240,
  "sequence.tracks[0].placements[1].id": "lighthouse-next",
  "sequence.tracks[0].placements[1].clipId": "lighthouse",
  "sequence.tracks[0].placements[1].sequenceStartFrame": 120,
  "sequence.tracks[0].placements[1].sourceInOffsetFrames": undefined,
  "sequence.tracks[0].placements[1].sourceOutOffsetFrames": undefined,
};

type Emissions = { sequences: Sequence[]; cutLists: (CutList | null)[] };
type RecordingWindow = Window & { sequenceEditorEmissions?: Emissions };
export const noEdits: Emissions = { sequences: [], cutLists: [] };

export async function recordEditorEmissions(page: Page) {
  await page.addInitScript(() => {
    const emissions: Emissions = { sequences: [], cutLists: [] };
    (window as RecordingWindow).sequenceEditorEmissions = emissions;
    window.addEventListener("sequence-editor:sequence-change", (event) => {
      emissions.sequences.push((event as CustomEvent<Sequence>).detail);
    });
    window.addEventListener("sequence-editor:cut-list-change", (event) => {
      emissions.cutLists.push((event as CustomEvent<CutList | null>).detail);
    });
  });
  return () =>
    page.evaluate(() => {
      const emissions = (window as RecordingWindow).sequenceEditorEmissions;
      if (!emissions) throw new Error("Expected the editor's callback recorder");
      return emissions;
    });
}
