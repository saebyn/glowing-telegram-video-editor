import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test.use({ viewport: { width: 1280, height: 1080 } });

const sequenceTimeline = (page: Page) =>
  page.getByRole("region", { name: "Sequence timeline", exact: true });

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  return (await locator.boundingBox())!;
}

async function inspectEdge(page: Page, edge: "Start" | "End") {
  const inspector = page.getByRole("region", { name: "Inspector" });
  await inspector
    .getByRole("group", { name: `${edge} edge` })
    .getByRole("button", {
      name: "Inspect transition",
    })
    .click();
  return inspector;
}

test("a full-placement fade leaves a separate strip for selection and movement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 120,
  });
  const timeline = sequenceTimeline(page);
  const placement = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await expect(timeline.getByRole("button", { name: "Adjust entry fade: Harbor" })).toHaveCount(0);
  await expect(
    timeline.getByRole("button", { name: "Adjust reveal fade: Lighthouse" }),
  ).toHaveCount(0);
  const rect = await box(placement);
  const indicator = await box(fade);
  expect(indicator.width).toBeCloseTo(rect.width + 2, 0);
  expect(indicator.height / rect.height).toBeGreaterThan(0.75);
  expect(indicator.height / rect.height).toBeLessThan(0.9);

  const x = rect.x + rect.width / 2;
  await page.mouse.click(x, indicator.y + indicator.height * 0.6);
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(placement).toHaveAttribute("aria-pressed", "false");
  expect(await emissions()).toStrictEqual(noEdits);

  await placement.click({ position: { x: rect.width / 2, y: rect.height - 4 } });
  await expect(placement).toHaveAttribute("aria-pressed", "true");
  await expect(fade).toHaveAttribute("aria-pressed", "false");
  const selected = await box(placement);
  const stripX = selected.x + selected.width / 2;
  const stripY = selected.y + selected.height - 4;
  await page.mouse.move(stripX, stripY);
  await page.mouse.down();
  await page.mouse.move(stripX + (selected.width + 2) / 5, stripY, { steps: 10 });
  await expect(
    timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" }),
  ).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();
  await expect.poll(emissions).toEqual({
    sequences: [
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            placements: [
              expect.objectContaining({ id: "harbor-open", sequenceStartFrame: 0 }),
              expect.objectContaining({
                id: "lighthouse-next",
                sequenceStartFrame: 144,
                transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 120 },
              }),
            ],
          }),
        ],
      }),
    ],
    cutListResults: [expect.objectContaining({ ok: false })],
  });
});

test("a dissolve and a fade made to overlap by a move share the lane and the selected body wins the hit test", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.durationFrames": 300,
    "sequence.tracks[0].placements[0].transitionOut.id": "harbor-dissolve",
    "sequence.tracks[0].placements[0].transitionOut.kind": "dissolve",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 20,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 132,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 30,
  });
  const timeline = sequenceTimeline(page);
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  const dissolve = timeline.getByRole("button", { name: "Select dissolve: Harbor" });
  const p = await box(lighthouse);
  const frameWidth = (p.width + 2) / 120; // Placement outline is inset one pixel on each side.
  const cutX = (await box(harbor)).x - 1 + 120 * frameWidth;
  const d = await box(dissolve);
  expect(d.x).toBeCloseTo(cutX - 10 * frameWidth, 0);
  expect(d.width).toBeCloseTo(20 * frameWidth, 0);
  expect(d.height / p.height).toBeGreaterThan(0.75);
  expect(d.height / p.height).toBeLessThan(0.9);
  await expect(timeline.getByRole("button", { name: "Adjust reveal fade: Harbor" })).toHaveCount(0);

  const x = p.x + p.width / 2;
  const stripY = p.y + p.height - 4;
  await page.mouse.move(x, stripY);
  await page.mouse.down();
  await page.mouse.move(x - 4 * frameWidth, stripY, { steps: 8 });
  await expect(
    timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" }),
  ).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();
  await expect.poll(emissions).toEqual({
    sequences: [
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            placements: [
              expect.objectContaining({
                id: "harbor-open",
                transitionOut: { id: "harbor-dissolve", kind: "dissolve", durationFrames: 20 },
              }),
              expect.objectContaining({
                id: "lighthouse-next",
                sequenceStartFrame: 128,
                transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 30 },
              }),
            ],
          }),
        ],
      }),
    ],
    cutListResults: [expect.objectContaining({ ok: false })],
  });
  await expect(
    page.getByText("CutList unavailable: a dissolve competes with another transition."),
  ).toBeVisible();

  const f = await box(fade);
  expect(f.y).toBeCloseTo(d.y, 0);
  expect(f.height).toBeCloseTo(d.height, 0);
  expect(f.width).toBeCloseTo(30 * frameWidth, 0);
  expect(f.x).toBeLessThan(d.x + d.width);
  const moved = await emissions();

  async function clickOverlap() {
    const currentFade = await box(fade);
    const currentDissolve = await box(dissolve);
    await page.mouse.click(
      (currentFade.x + currentDissolve.x + currentDissolve.width) / 2,
      currentFade.y + currentFade.height * 0.7,
    );
  }

  // Switch through owning edges, not through the ambiguous part of the lane.
  // Each selection raises the chosen body even when its owner renders first.
  await harbor.click({ position: { x: (await box(harbor)).width / 2, y: p.height - 4 } });
  const inspector = await inspectEdge(page, "End");
  await expect(dissolve).toHaveAttribute("aria-pressed", "true");
  await clickOverlap();
  await expect(dissolve).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Owner: Harbor — Main, sequence frame 0")).toBeVisible();
  await lighthouse.click({ position: { x: p.width / 2, y: p.height - 4 } });
  await inspectEdge(page, "Start");
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await clickOverlap();
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Owner: Lighthouse — Main, sequence frame 128")).toBeVisible();
  expect(await emissions()).toStrictEqual(moved);
});

test("a narrow placement still exposes its one-frame fade through Placement Properties", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.durationFrames": 3600,
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": -115,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 1,
  });
  const timeline = sequenceTimeline(page);
  const placement = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  const p = await box(placement);
  const f = await box(fade);
  expect(p.width).toBeLessThan(4);
  expect(f.width).toBeLessThan(1); // No minimum marker or inflated hit area.
  expect(f.width).toBeCloseTo(p.width / 5, 1);
  await page.mouse.click(p.x + p.width / 2, p.y + p.height - 5);
  await expect(placement).toHaveAttribute("aria-pressed", "true");
  const inspector = await inspectEdge(page, "Start");
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("1");
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("the Split blade can cut through a visible full-placement transition", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 120,
  });
  const timeline = sequenceTimeline(page);
  await page.getByRole("button", { name: "Split mode" }).click();
  await expect(timeline.getByRole("button", { name: "Select entry fade: Lighthouse" })).toHaveCount(
    0,
  );
  await expect(timeline.getByRole("button", { name: "Adjust entry fade: Lighthouse" })).toHaveCount(
    0,
  );
  const f = await box(timeline.getByText("Fade in", { exact: true }));
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await expect(timeline.getByText("Split at sequence frame 180")).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.down();
  await page.mouse.up();
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements)
    .toEqual([
      expect.objectContaining({ id: "harbor-open", sequenceStartFrame: 0 }),
      expect.objectContaining({
        id: "lighthouse-next",
        sequenceStartFrame: 120,
        sourceOutOffsetFrames: -60,
        transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 120 },
      }),
      expect.objectContaining({
        clipId: "lighthouse",
        sequenceStartFrame: 180,
        sourceInOffsetFrames: 60,
      }),
    ]);
  const edit = await emissions();
  expect(edit.sequences).toHaveLength(1);
  expect(edit.cutListResults).toHaveLength(1);
});
