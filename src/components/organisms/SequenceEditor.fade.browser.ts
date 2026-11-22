import { expect, test, type Locator, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";
const straightCut: Sequence = {
  durationFrames: 240,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
        { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
      ],
    },
  ],
};
const inputMedia: CutList["inputMedia"] = [
  {
    s3Location: "s3://sequence-fixtures/harbor.mp4",
    sections: [{ startFrame: 114, endFrame: 234 }],
  },
  {
    s3Location: "s3://sequence-fixtures/lighthouse.mp4",
    sections: [{ startFrame: 501, endFrame: 621 }],
  },
];

const paddedStraightCut: Sequence = {
  ...straightCut,
  tracks: [
    { id: "cutaways", label: "Cutaways", placements: [] },
    straightCut.tracks[0],
    { id: "alternate", label: "Alternate", placements: [] },
  ],
};
const paddedStraightCutArgs = {
  "sequence.tracks[0].placements[0]": undefined,
  "sequence.tracks[1].placements[0].id": "harbor-open",
  "sequence.tracks[1].placements[0].sourceOutOffsetFrames": undefined,
  "sequence.tracks[1].placements[1].id": "lighthouse-next",
  "sequence.tracks[1].placements[1].clipId": "lighthouse",
  "sequence.tracks[1].placements[1].sequenceStartFrame": 120,
  "sequence.tracks[2].placements[0]": undefined,
};

test("the Inspector edits an entry fade on a track between empty tracks", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, paddedStraightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  const entry = page.getByLabel("Entry fade duration (sequence frames)");
  await expect(entry).toBeVisible();
  await entry.fill("24");
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();

  const next = structuredClone(paddedStraightCut);
  next.tracks[1].placements[1].entryTransitionFrames = 24;
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 24 } },
    ],
  };
  await expect.poll(emissions).toStrictEqual({ sequences: [next], cutLists: [cutList] });
});

async function dragFade(page: Page, handle: Locator, dx: number) {
  await expect(handle).toBeVisible();
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 10 });
}

test("a timeline reveal grip edits a placement on a track between empty tracks", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, paddedStraightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toBeVisible();
  const { width } = (await harbor.boundingBox())!;
  await dragFade(page, timeline.getByLabel("Adjust reveal fade: Harbor"), -width / 4);
  await expect(timeline.getByText("Fade out", { exact: true })).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  const next = structuredClone(paddedStraightCut);
  next.tracks[1].placements[0].revealTransitionFrames = 30;
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 30 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect.poll(emissions).toStrictEqual({ sequences: [next], cutLists: [cutList] });
});

test("sequences with multiple occupied tracks do not expose fade controls", async ({ page }) => {
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector).toContainText("Harbor");
  await expect(inspector.getByLabel("Entry fade duration (sequence frames)")).toHaveCount(0);
  await expect(timeline.getByRole("button", { name: "Adjust reveal fade: Harbor" })).toHaveCount(0);
});

test("dragging Lighthouse's entry handle previews 30 frames and commits once without moving the cut", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  // A fade handle on an unselected placement must not change the existing selection.
  await harbor.click();
  const handle = timeline.getByLabel("Adjust entry fade: Lighthouse");
  await handle.scrollIntoViewIfNeeded();
  const before = (await lighthouse.boundingBox())!;
  const indicator = timeline.getByText("Fade in", { exact: true });
  await expect(indicator).toHaveCount(0);

  // The fixture's Lighthouse placement spans 120 sequence frames.
  await dragFade(page, handle, before.width / 4);
  await expect(indicator).toBeVisible();
  const draft = (await indicator.boundingBox())!;
  expect(Math.abs(draft.x - before.x)).toBeLessThan(2);
  expect(Math.abs(draft.width - before.width / 4)).toBeLessThan(2);
  await expect(timeline.getByText("Fade out", { exact: true })).toHaveCount(0);
  await expect(
    timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" }),
  ).toHaveCount(0);
  expect(await lighthouse.boundingBox()).toEqual(before);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  const next = structuredClone(straightCut);
  next.tracks[0].placements[1].entryTransitionFrames = 30;
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 30 } },
    ],
  };
  await expect.poll(emissions).toStrictEqual({ sequences: [next], cutLists: [cutList] });
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect(indicator).toBeVisible();
  expect(await lighthouse.boundingBox()).toEqual(before);
});

test("Harbor's separate reveal handle previews 48 frames from the trailing edge and edits the Inspector's reveal field", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();
  const before = (await harbor.boundingBox())!;
  const entry = timeline.getByRole("button", { name: "Adjust entry fade: Harbor" });
  const reveal = timeline.getByRole("button", { name: "Adjust reveal fade: Harbor" });
  await expect(entry).toBeVisible();
  const entryBox = (await entry.boundingBox())!;
  await expect(reveal).toBeVisible();
  const revealBox = (await reveal.boundingBox())!;
  expect(entryBox.x + entryBox.width).toBeLessThan(revealBox.x);
  expect(revealBox.x + revealBox.width).toBeCloseTo(before.x + before.width, 0);

  await dragFade(page, reveal, -before.width * 0.4);
  const indicator = timeline.getByText("Fade out", { exact: true });
  await expect(indicator).toBeVisible();
  const draft = (await indicator.boundingBox())!;
  expect(Math.abs(draft.x + draft.width - (before.x + before.width))).toBeLessThan(2);
  expect(Math.abs(draft.width - before.width * 0.4)).toBeLessThan(2);
  await expect(timeline.getByText("Fade in", { exact: true })).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  const next = structuredClone(straightCut);
  next.tracks[0].placements[0].revealTransitionFrames = 48;
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 48 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect.poll(emissions).toStrictEqual({ sequences: [next], cutLists: [cutList] });
  await expect(page.getByLabel("Reveal fade duration (sequence frames)")).toHaveValue("48");
  await expect(page.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("");
  expect(await harbor.boundingBox()).toMatchObject({ x: before.x, width: before.width });
});

test("a placement stays trimmable after authoring a fade on the timeline", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  const before = (await lighthouse.boundingBox())!;
  await dragFade(page, timeline.getByLabel("Adjust entry fade: Lighthouse"), before.width / 4);
  await page.mouse.up();
  await expect(page.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("30");
  const afterFade = await emissions();
  expect(afterFade.sequences).toHaveLength(1);

  const leading = timeline.getByRole("button", { name: "Trim leading edge: Lighthouse" });
  await leading.scrollIntoViewIfNeeded();
  await expect(
    timeline.getByRole("button", { name: "Trim trailing edge: Lighthouse" }),
  ).toBeVisible();
  await expect(page.getByLabel("Source out (exclusive frame)")).toHaveValue("621");
  // Move the leading edge 24 frames later while keeping the trailing edge at 240.
  await dragFade(page, leading, before.width / 5);
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse · Sequence frame 144");
  expect(await emissions()).toStrictEqual(afterFade);
  await page.mouse.up();

  const trimmed: Sequence = {
    durationFrames: 240,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
          {
            id: "lighthouse-next",
            clipId: "lighthouse",
            sequenceStartFrame: 144,
            sourceInOffsetFrames: 24,
            entryTransitionFrames: 30,
          },
        ],
      },
    ],
  };
  await expect.poll(emissions).toStrictEqual({
    sequences: [...afterFade.sequences, trimmed],
    cutLists: [...afterFade.cutLists, null],
  });
  await expect(page.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("30");
  const placement = (await lighthouse.boundingBox())!;
  const fade = (await timeline.getByText("Fade in", { exact: true }).boundingBox())!;
  expect(fade.x).toBeCloseTo(placement.x, 0);
  expect(fade.width).toBeCloseTo((30 * placement.width) / 96, 0);
  expect(placement.x + placement.width).toBeCloseTo(before.x + before.width, 0);
});

test("a trim that would overlap the fades explains why and commits neither callback", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  await page.getByLabel("Entry fade duration (sequence frames)").fill("30");
  await page.getByRole("button", { name: "Apply entry fade" }).click();
  await page.getByLabel("Reveal fade duration (sequence frames)").fill("20");
  await page.getByRole("button", { name: "Apply reveal fade" }).click();
  const initial = await emissions();
  expect(initial.sequences).toHaveLength(2);

  const width = (await lighthouse.boundingBox())!.width;
  const leading = timeline.getByRole("button", { name: "Trim leading edge: Lighthouse" });
  await leading.scrollIntoViewIfNeeded();
  await dragFade(page, leading, (71 * width) / 120);
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse · Sequence frame 191 · Blocked: The fades need at least 50 sequence frames",
  );
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(initial);
  await expect(page.getByLabel("Source out (exclusive frame)")).toHaveAccessibleDescription(
    "Keep at least 50 sequence frames for the fades.",
  );
});

test("adjacent fade regions leave both handles usable, and a valid fade still commits when it cannot compile", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();
  const before = (await harbor.boundingBox())!;
  await page.getByLabel("Entry fade duration (sequence frames)").fill("72");
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();
  await page.getByLabel("Reveal fade duration (sequence frames)").fill("48");
  await page.getByRole("button", { name: "Apply reveal fade", exact: true }).click();
  await expect(page.getByLabel("Reveal fade duration (sequence frames)")).toHaveValue("48");
  const initial = (await emissions())!;
  expect(initial.cutLists).toHaveLength(2);
  expect(initial.cutLists[1]).not.toBeNull();

  // At 72 + 48 = 120, the handles share a sequence position, not a hit target.
  // Extending just the entry by 18 frames makes the fade regions intersect.
  await dragFade(
    page,
    timeline.getByRole("button", { name: "Adjust entry fade: Harbor" }),
    before.width * 0.15,
  );
  const entry = timeline.getByText("Fade in", { exact: true });
  await expect
    .poll(async () => (await entry.boundingBox())?.width)
    .toBeCloseTo(before.width * 0.75, -1);
  expect(await emissions()).toStrictEqual(initial);
  await page.mouse.up();

  const next = structuredClone(straightCut);
  Object.assign(next.tracks[0].placements[0], {
    entryTransitionFrames: 90,
    revealTransitionFrames: 48,
  });
  await expect.poll(emissions).toStrictEqual({
    sequences: [...initial.sequences, next],
    cutLists: [...initial.cutLists, null],
  });
});

test("a fade drag outside the Inspector's bounds leaves the authored fade and cut unchanged", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  const input = page.getByLabel("Entry fade duration (sequence frames)");
  await expect(input).toHaveAttribute("min", "1");
  await expect(input).toHaveAttribute("max", "120");
  await input.fill("30");
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();
  const indicator = timeline.getByText("Fade in", { exact: true });
  await expect(indicator).toBeVisible();
  const initial = (await emissions())!;
  expect(initial.sequences).toHaveLength(1);
  const handle = timeline.getByRole("button", { name: "Adjust entry fade: Lighthouse" });
  await handle.scrollIntoViewIfNeeded();
  const before = await lighthouse.boundingBox();
  if (!before) throw new Error("Expected a visible Lighthouse placement");
  const boundsMessage = "Fade duration must be between 1 and 120 sequence frames.";

  for (const dx of [-before.width / 4, before.width * 0.8]) {
    // Exactly zero would remove the existing fade; the other drag goes past 120.
    await dragFade(page, handle, dx);
    await expect(handle).toHaveAccessibleDescription(boundsMessage);
    expect(await emissions()).toStrictEqual(initial);
    await page.mouse.up();
    await expect(handle).not.toHaveAccessibleDescription(boundsMessage);
    expect(await emissions()).toStrictEqual(initial);
    await expect(input).toHaveValue("30");
    await expect(timeline).toContainText("Duration: 00:04");
    expect(await lighthouse.boundingBox()).toEqual(before);
    expect((await indicator.boundingBox())?.width).toBeCloseTo(before.width / 4, 0);
  }
});

test("resizing during a fade drag cancels the preview instead of committing at a different scale", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible();
  const before = (await lighthouse.boundingBox())!;
  await dragFade(
    page,
    timeline.getByRole("button", { name: "Adjust entry fade: Lighthouse" }),
    before.width / 4,
  );
  const indicator = timeline.getByText("Fade in", { exact: true });
  await expect(indicator).toBeVisible();

  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, width: viewport.width + 180 });
  await expect(indicator).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
});
