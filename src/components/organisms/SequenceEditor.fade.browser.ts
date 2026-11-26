import { expect, test, type Locator, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  blockedOutput,
  compiled,
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
  await edgeAction(page, "Start", "Add transition").click();
  const entry = page.getByLabel("Duration (sequence frames)");
  await expect(entry).toHaveValue("30");
  const initial = await emissions();
  expect(initial.sequences).toHaveLength(1);
  const id = initial.sequences[0].tracks[1].placements[1].transitionIn?.id;
  expect(id).toEqual(expect.stringMatching(/\S/));
  await entry.fill("24");
  expect(await emissions()).toStrictEqual(initial);
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  const next = structuredClone(paddedStraightCut);
  Object.assign(next.tracks[1].placements[1], {
    transitionIn: { id, kind: "fade", durationFrames: 24 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 24 } },
    ],
  };
  await expect.poll(emissions).toStrictEqual({
    sequences: [...initial.sequences, next],
    cutListResults: [...initial.cutListResults, compiled(cutList)],
  });
});

function edgeAction(
  page: Page,
  edge: "Start" | "End",
  action: "Add transition" | "Inspect transition",
) {
  return page
    .getByRole("region", { name: "Inspector" })
    .getByRole("group", { name: `${edge} edge` })
    .getByRole("button", { name: action });
}

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

test("a covered transition can be selected without selecting its owner or emitting an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[2].placements[0].transitionIn.id": "covered-entry",
    "sequence.tracks[2].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[2].placements[0].transitionIn.durationFrames": 24,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await fade.click({ timeout: 5_000 });
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(
    inspector.getByText("Owner: Lighthouse — Alternate, sequence frame 120"),
  ).toBeVisible();
  await expect(inspector.getByText("24 sequence frames", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("an editable one-frame fade can be selected separately from its resize handle", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 1,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await fade.click();
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(timeline.getByLabel("Adjust entry fade: Lighthouse")).toBeVisible();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("1");
  await expect(inspector.getByRole("spinbutton")).toHaveCount(1);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a timeline reveal grip edits a placement on a track between empty tracks", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    ...paddedStraightCutArgs,
    "sequence.tracks[1].placements[0].transitionOut.id": "harbor-reveal",
    "sequence.tracks[1].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[1].placements[0].transitionOut.durationFrames": 12,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toBeVisible();
  const { width } = (await harbor.boundingBox())!;
  await dragFade(page, timeline.getByLabel("Adjust reveal fade: Harbor"), -(width * 18) / 120);
  await expect(timeline.getByText("Fade out", { exact: true })).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  const next = structuredClone(paddedStraightCut);
  Object.assign(next.tracks[1].placements[0], {
    transitionOut: { id: "harbor-reveal", kind: "fade", durationFrames: 30 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 30 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [next], cutListResults: [compiled(cutList)] });
});

test("the Inspector authors a reveal to the lower track in a layered edit", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).first().click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await edgeAction(page, "End", "Add transition").click();
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 561 }],
      },
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 174, endFrame: 354 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 30 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect.poll(emissions).toEqual({
    sequences: [
      expect.objectContaining({
        durationFrames: 240,
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -60,
                transitionOut: {
                  id: expect.stringMatching(/\S/),
                  kind: "fade",
                  durationFrames: 30,
                },
              },
            ],
          },
          expect.objectContaining({ id: "main" }),
          expect.objectContaining({ id: "alternate" }),
        ],
      }),
    ],
    cutListResults: [compiled(cutList)],
  });
});

test("a layered timeline fade commits but explains a window interrupted by another visible placement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.durationFrames": 260, // An unrelated trailing gap must not hide transition feedback.
    "sequence.tracks[1].placements[0].transitionIn.id": "harbor-entry",
    "sequence.tracks[1].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[1].placements[0].transitionIn.durationFrames": 12,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const width = (await harbor.boundingBox())!.width;
  await dragFade(page, timeline.getByLabel("Adjust entry fade: Harbor"), (width * 68) / 240);
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  await expect.poll(emissions).toEqual({
    sequences: [
      expect.objectContaining({
        tracks: [
          expect.objectContaining({ id: "cutaways" }),
          expect.objectContaining({
            id: "main",
            placements: [
              expect.objectContaining({
                id: "harbor-bed",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 120,
                transitionIn: {
                  id: "harbor-entry",
                  kind: "fade",
                  durationFrames: 80,
                },
              }),
            ],
          }),
          expect.objectContaining({ id: "alternate" }),
        ],
      }),
    ],
    cutListResults: [blockedOutput],
  });
  await expect(
    page.getByText("CutList unavailable: an authored fade crosses a visible cut."),
  ).toBeVisible();
});

test("a gap elsewhere does not block a locally representable layered fade", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.durationFrames": 260,
    "sequence.tracks[0].placements[0].transitionOut.id": "lighthouse-reveal",
    "sequence.tracks[0].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 6,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).first();
  const width = (await lighthouse.boundingBox())!.width;
  await dragFade(page, timeline.getByLabel("Adjust reveal fade: Lighthouse").first(), -width / 10);
  await page.mouse.up();
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements[0].transitionOut)
    .toEqual({ id: "lighthouse-reveal", kind: "fade", durationFrames: 12 });
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await expect(page.getByText(/^CutList unavailable:.*fade/)).toHaveCount(0);
});

test("opening a gap preserves both adjoining fades and reports their missing contribution", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionOut.id": "harbor-reveal",
    "sequence.tracks[0].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 12,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 24,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  await page.keyboard.press("]");

  await expect.poll(emissions).toEqual({
    sequences: [
      {
        durationFrames: 241,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              {
                ...straightCut.tracks[0].placements[0],
                transitionOut: { id: "harbor-reveal", kind: "fade", durationFrames: 12 },
              },
              {
                ...straightCut.tracks[0].placements[1],
                sequenceStartFrame: 121,
                transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 24 },
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [blockedOutput],
  });
  await expect(page.getByText("CutList unavailable: an authored fade meets a gap.")).toBeVisible();
});

test("nudging two fades onto the same cut preserves both and reports an output conflict", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[0].placements[0].transitionOut.id": "lighthouse-reveal",
    "sequence.tracks[0].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 12,
    "sequence.tracks[1].placements[0].sequenceStartFrame": 61,
    "sequence.tracks[1].placements[0].sourceOutOffsetFrames": 0,
    "sequence.tracks[1].placements[0].transitionIn.id": "harbor-entry",
    "sequence.tracks[1].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[1].placements[0].transitionIn.durationFrames": 24,
    // The lower placement fills the frame between the two fades and the tail.
    "sequence.tracks[2].placements[0].sequenceStartFrame": 0,
    "sequence.tracks[2].placements[0].sourceInOffsetFrames": undefined,
    "sequence.tracks[2].placements[0].sourceOutOffsetFrames": 120,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const conflict = page.getByText(
    "CutList unavailable: authored fades overlap or compete at the same cut.",
  );
  await expect(page.getByText(/^CutList unavailable:/)).toHaveCount(0);
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  await expect(page.getByRole("region", { name: "Inspector" })).toContainText(
    "Sequence start/end (sequence frames): 61 inclusive – 181 exclusive",
  );
  expect(await emissions()).toStrictEqual(noEdits);
  await page.keyboard.press("[");

  await expect.poll(emissions).toEqual({
    sequences: [
      {
        durationFrames: 240,
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -60,
                transitionOut: { id: "lighthouse-reveal", kind: "fade", durationFrames: 12 },
              },
            ],
          },
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "harbor-bed",
                clipId: "harbor",
                sequenceStartFrame: 60,
                sourceOutOffsetFrames: 0,
                transitionIn: { id: "harbor-entry", kind: "fade", durationFrames: 24 },
              },
            ],
          },
          {
            id: "alternate",
            label: "Alternate",
            placements: [
              {
                id: "lighthouse-alternate",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 120,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      { ok: false, issues: [{ code: "fade-overlap", transitionId: "harbor-entry" }] },
    ],
  });
  await expect(conflict).toBeVisible();
});

test("dragging Lighthouse's entry handle previews 30 frames and commits once without moving the cut", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 12,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  // A fade handle on an unselected placement must not change the existing selection.
  await harbor.click();
  const handle = timeline.getByLabel("Adjust entry fade: Lighthouse");
  await handle.scrollIntoViewIfNeeded();
  const before = (await lighthouse.boundingBox())!;
  const indicator = timeline.getByText("Fade in", { exact: true });
  expect((await indicator.boundingBox())?.width).toBeCloseTo((before.width + 2) / 10, 0);

  // The fixture's Lighthouse placement spans 120 sequence frames.
  await dragFade(page, handle, (before.width * 18) / 120);
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
  Object.assign(next.tracks[0].placements[1], {
    transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 30 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 30 } },
    ],
  };
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [next], cutListResults: [compiled(cutList)] });
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect(indicator).toBeVisible();
  expect(await lighthouse.boundingBox()).toEqual(before);
});

test("Harbor's separate reveal handle previews 48 frames from the trailing edge and edits the Inspector's reveal field", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionIn.id": "harbor-entry",
    "sequence.tracks[0].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[0].transitionIn.durationFrames": 12,
    "sequence.tracks[0].placements[0].transitionOut.id": "harbor-reveal",
    "sequence.tracks[0].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 12,
  });
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
  expect(revealBox.x + revealBox.width / 2).toBeCloseTo(
    before.x + before.width + 1 - (before.width + 2) / 10,
    0,
  );

  await dragFade(page, reveal, -before.width * 0.3);
  const indicator = timeline.getByText("Fade out", { exact: true });
  await expect(indicator).toBeVisible();
  const draft = (await indicator.boundingBox())!;
  expect(Math.abs(draft.x + draft.width - (before.x + before.width))).toBeLessThan(2);
  expect(Math.abs(draft.width - before.width * 0.4)).toBeLessThan(2);
  await expect(timeline.getByText("Fade in", { exact: true })).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  const next = structuredClone(straightCut);
  Object.assign(next.tracks[0].placements[0], {
    transitionIn: { id: "harbor-entry", kind: "fade", durationFrames: 12 },
    transitionOut: { id: "harbor-reveal", kind: "fade", durationFrames: 48 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      {
        mediaIndex: 0,
        sectionIndex: 0,
        transitionIn: { type: "fade", duration: 12 },
        transitionOut: { type: "fade", duration: 48 },
      },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [next], cutListResults: [compiled(cutList)] });
  await edgeAction(page, "End", "Inspect transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("48");
  await expect(page.getByText("Edge: End", { exact: true })).toBeVisible();
  expect(await harbor.boundingBox()).toMatchObject({ x: before.x, width: before.width });
});

test("a placement stays trimmable after adding a fade in Placement Properties", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  const before = (await lighthouse.boundingBox())!;
  await edgeAction(page, "Start", "Add transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  const afterFade = await emissions();
  expect(afterFade.sequences).toHaveLength(1);
  const entryId = afterFade.sequences[0].tracks[0].placements[1].transitionIn?.id;
  expect(entryId).toEqual(expect.stringMatching(/\S/));
  await lighthouse.click();

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
            transitionIn: { id: entryId!, kind: "fade", durationFrames: 30 },
          },
        ],
      },
    ],
  };
  await expect.poll(emissions).toStrictEqual({
    sequences: [...afterFade.sequences, trimmed],
    cutListResults: [...afterFade.cutListResults, blockedOutput],
  });
  await edgeAction(page, "Start", "Inspect transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  const placement = (await lighthouse.boundingBox())!;
  const fade = (await timeline.getByText("Fade in", { exact: true }).boundingBox())!;
  expect(fade.x).toBeCloseTo(placement.x - 1, 0);
  expect(fade.width).toBeCloseTo((30 * (placement.width + 2)) / 96, 0);
  expect(placement.x + placement.width).toBeCloseTo(before.x + before.width, 0);
});

test("a trim preserves both fades and reports unsupported overlapping output", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 30,
    "sequence.tracks[0].placements[1].transitionOut.id": "lighthouse-reveal",
    "sequence.tracks[0].placements[1].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[1].transitionOut.durationFrames": 20,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  const width = (await lighthouse.boundingBox())!.width;
  const leading = timeline.getByRole("button", { name: "Trim leading edge: Lighthouse" });
  await leading.scrollIntoViewIfNeeded();
  await dragFade(page, leading, (71 * width) / 120);
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse · Sequence frame 191");
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();
  const next = structuredClone(straightCut);
  Object.assign(next.tracks[0].placements[1], {
    sequenceStartFrame: 191,
    sourceInOffsetFrames: 71,
    transitionIn: { id: "lighthouse-entry", kind: "fade", durationFrames: 30 },
    transitionOut: { id: "lighthouse-reveal", kind: "fade", durationFrames: 20 },
  });
  await expect.poll(emissions).toStrictEqual({
    sequences: [next],
    cutListResults: [blockedOutput],
  });
  await expect(
    page.getByText("CutList unavailable: authored fades overlap or compete at the same cut."),
  ).toBeVisible();
});

test("an entry fade keeps the recorded source extension after a trailing trim", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionIn.id": "harbor-entry",
    "sequence.tracks[0].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[0].transitionIn.durationFrames": 20,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  await page.getByLabel("Source out (exclusive frame)").fill("125");
  await page.getByRole("button", { name: "Trim placement", exact: true }).click();
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements[0])
    .toEqual({
      id: "harbor-open",
      clipId: "harbor",
      sequenceStartFrame: 0,
      sourceOutOffsetFrames: -109,
      transitionIn: { id: "harbor-entry", kind: "fade", durationFrames: 20 },
    });
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  const fade = timeline.getByRole("button", { name: "Select entry fade: Harbor" });
  const shortened = (await timeline
    .getByRole("button", { name: "Harbor", exact: true })
    .boundingBox())!;
  const indicator = (await fade.boundingBox())!;
  // The new placement is 11 frames long, but the fade still owns 20.
  expect(indicator.width).toBeCloseTo(((shortened.width + 2) * 20) / 11, 0);
  await fade.click();
  await expect(
    page.getByText("Transition source extension: 125 inclusive – 134 exclusive"),
  ).toBeVisible();
});

test("adjacent fades leave both handles usable, but a resize cannot make them compete", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();
  const before = (await harbor.boundingBox())!;
  await edgeAction(page, "Start", "Add transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  await page.getByLabel("Duration (sequence frames)").fill("72");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(timeline.getByRole("button", { name: "Select entry fade: Harbor" })).toContainText(
    "Fade in",
  );
  await harbor.click({ position: { x: before.width / 2, y: before.height - 4 } });
  await edgeAction(page, "End", "Add transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  await page.getByLabel("Duration (sequence frames)").fill("48");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("48 sequence frames", { exact: true })).toBeVisible();
  const initial = (await emissions())!;
  expect(initial.cutListResults).toHaveLength(4);
  expect(initial.cutListResults[3]).toHaveProperty("ok", true);
  const { transitionIn, transitionOut } = initial.sequences[3].tracks[0].placements[0];
  expect(transitionIn?.id).toEqual(expect.stringMatching(/\S/));
  expect(transitionOut?.id).toEqual(expect.stringMatching(/\S/));
  expect(transitionIn?.id).not.toBe(transitionOut?.id);

  // At 72 + 48 = 120, the handles share a sequence position, not a hit target.
  // Extending just the entry by 18 frames makes the fade regions intersect.
  const handle = timeline.getByRole("button", { name: "Adjust entry fade: Harbor" });
  await dragFade(page, handle, before.width * 0.15);
  await expect(handle).toHaveAccessibleDescription(
    "This transition competes with another transition on the same cut or visible frames.",
  );
  expect(await emissions()).toStrictEqual(initial);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(initial);
  await harbor.click({ position: { x: before.width / 2, y: before.height - 4 } });
  await edgeAction(page, "Start", "Inspect transition").click();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("72");
});

test("a fade drag outside the Inspector's bounds leaves the authored fade and cut unchanged", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  await edgeAction(page, "Start", "Add transition").click();
  const input = page.getByLabel("Duration (sequence frames)");
  await expect(input).toHaveAttribute("min", "1");
  await expect(input).toHaveAttribute("max", "120");
  await expect(input).toHaveValue("30");
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
    expect((await indicator.boundingBox())?.width).toBeCloseTo((before.width + 2) / 4, 0);
  }
});

test("resizing during a fade drag cancels the preview instead of committing at a different scale", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 12,
  });
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
  expect((await indicator.boundingBox())?.width).toBeCloseTo(((before.width + 2) * 42) / 120, 0);

  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, width: viewport.width + 180 });
  await expect
    .poll(async () => {
      const placement = (await lighthouse.boundingBox())!;
      const fade = (await indicator.boundingBox())!;
      return Math.abs(fade.width - (placement.width + 2) / 10);
    })
    .toBeLessThan(0.5);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
});
