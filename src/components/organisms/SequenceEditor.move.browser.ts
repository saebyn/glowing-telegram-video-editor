import { expect, test, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";

type Emissions = { sequences: Sequence[]; cutLists: (CutList | null)[] };
type RecordingWindow = Window & { sequenceEditorEmissions?: Emissions };
const noEdits: Emissions = { sequences: [], cutLists: [] };

async function openMoveStory(page: Page, story: string) {
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
  await page.goto(`/iframe.html?id=organisms-sequenceeditor--${story}&viewMode=story`);
  return () => page.evaluate(() => (window as RecordingWindow).sequenceEditorEmissions);
}

test("moving a placement preserves duration, trims and its fade, leaving an uncovered tail", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 372,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
          {
            id: "lighthouse-close",
            clipId: "lighthouse",
            sequenceStartFrame: 120,
            sourceInOffsetFrames: -6,
            sourceOutOffsetFrames: 6,
            entryTransitionFrames: 30,
          },
        ],
      },
    ],
  };

  const emissions = await openMoveStory(page, "placement-move");
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  const [first, last] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!first || !last || first.x + first.width >= last.x) {
    throw new Error("Expected a gap between Harbor and Lighthouse");
  }
  const startX = last.x + last.width / 2;
  const rowY = last.y + last.height / 2;
  const pixelsFor120Frames = (last.x - first.x) / 2;

  async function dragTo(x: number) {
    await page.mouse.move(startX, rowY);
    await page.mouse.down();
    await page.mouse.move(x, rowY, { steps: 12 });
    expect(await emissions()).toStrictEqual(noEdits);
    await page.mouse.up();
  }

  // Releasing over Harbor or pushing the effective source range past the end commits neither callback.
  await dragTo(startX - 2 * pixelsFor120Frames);
  expect(await emissions()).toStrictEqual(noEdits);
  await dragTo(startX + pixelsFor120Frames / 20);
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");

  // The placement now starts immediately after Harbor, leaving the last 120 frames uncovered.
  await dragTo(startX - pixelsFor120Frames);
  await expect.poll(emissions).toStrictEqual({ sequences: [expectedSequence], cutLists: [null] });
  await expect(timeline).toContainText("Duration: 00:06.2");
  await expect(timeline.getByText("Fade in", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await lighthouse.boundingBox())?.x)
    .toBeCloseTo(first.x + pixelsFor120Frames, 0);
});
