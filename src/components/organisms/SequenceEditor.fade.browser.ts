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
  const entry = page.getByLabel("Entry fade duration (sequence frames)");
  await expect(entry).toBeVisible();
  await entry.fill("24");
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();

  const next = structuredClone(paddedStraightCut);
  Object.assign(next.tracks[1].placements[1], {
    entryTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 24 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 24 } },
    ],
  };
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [next], cutListResults: [compiled(cutList)] });
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

test("a covered transition can be selected without selecting its owner or emitting an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[2].placements[0].entryTransition.id": "covered-entry",
    "sequence.tracks[2].placements[0].entryTransition.kind": "fade",
    "sequence.tracks[2].placements[0].entryTransition.durationFrames": 24,
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
    "sequence.tracks[0].placements[1].entryTransition.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 1,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await fade.click();
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(timeline.getByLabel("Adjust entry fade: Lighthouse")).toBeVisible();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("1");
  await expect(inspector.getByLabel("Reveal fade duration (sequence frames)")).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
});

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
  Object.assign(next.tracks[1].placements[0], {
    revealTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 30 },
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
  const reveal = inspector.getByLabel("Reveal fade duration (sequence frames)");
  await expect(reveal).toBeVisible();
  await reveal.fill("12");
  await inspector.getByRole("button", { name: "Apply reveal fade" }).click();
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
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 12 } },
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
                revealTransition: {
                  id: expect.stringMatching(/\S/),
                  kind: "fade",
                  durationFrames: 12,
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
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const width = (await harbor.boundingBox())!.width;
  await dragFade(page, timeline.getByLabel("Adjust entry fade: Harbor"), width / 3);
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
                entryTransition: {
                  id: expect.stringMatching(/\S/),
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
  await openWorkflow(page, layeredEditStoryId, { "sequence.durationFrames": 260 });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).first();
  const width = (await lighthouse.boundingBox())!.width;
  await dragFade(page, timeline.getByLabel("Adjust reveal fade: Lighthouse").first(), -width / 5);
  await page.mouse.up();
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements[0].revealTransition)
    .toEqual({ id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 12 });
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await expect(page.getByText("CutList unavailable:")).toHaveCount(0);
});

test("opening a gap preserves both adjoining fades and reports their missing contribution", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].revealTransition.id": "harbor-reveal",
    "sequence.tracks[0].placements[0].revealTransition.kind": "fade",
    "sequence.tracks[0].placements[0].revealTransition.durationFrames": 12,
    "sequence.tracks[0].placements[1].entryTransition.id": "lighthouse-entry",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 24,
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
                revealTransition: { id: "harbor-reveal", kind: "fade", durationFrames: 12 },
              },
              {
                ...straightCut.tracks[0].placements[1],
                sequenceStartFrame: 121,
                entryTransition: { id: "lighthouse-entry", kind: "fade", durationFrames: 24 },
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
  Object.assign(next.tracks[0].placements[1], {
    entryTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 30 },
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
  Object.assign(next.tracks[0].placements[0], {
    revealTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 48 },
  });
  const cutList: CutList = {
    version: "1.0.0",
    inputMedia,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 48 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [next], cutListResults: [compiled(cutList)] });
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
  const entryId = afterFade.sequences[0].tracks[0].placements[1].entryTransition?.id;
  expect(entryId).toEqual(expect.stringMatching(/\S/));

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
            entryTransition: { id: entryId!, kind: "fade", durationFrames: 30 },
          },
        ],
      },
    ],
  };
  await expect.poll(emissions).toStrictEqual({
    sequences: [...afterFade.sequences, trimmed],
    cutListResults: [...afterFade.cutListResults, blockedOutput],
  });
  await expect(page.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("30");
  const placement = (await lighthouse.boundingBox())!;
  const fade = (await timeline.getByText("Fade in", { exact: true }).boundingBox())!;
  expect(fade.x).toBeCloseTo(placement.x, 0);
  expect(fade.width).toBeCloseTo((30 * placement.width) / 96, 0);
  expect(placement.x + placement.width).toBeCloseTo(before.x + before.width, 0);
});

test("a trim preserves both fades and reports unsupported overlapping output", async ({ page }) => {
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
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse · Sequence frame 191");
  expect(await emissions()).toStrictEqual(initial);
  await page.mouse.up();
  const { entryTransition, revealTransition } = initial.sequences[1].tracks[0].placements[1];
  const next = structuredClone(straightCut);
  Object.assign(next.tracks[0].placements[1], {
    sequenceStartFrame: 191,
    sourceInOffsetFrames: 71,
    entryTransition,
    revealTransition,
  });
  await expect.poll(emissions).toStrictEqual({
    sequences: [...initial.sequences, next],
    cutListResults: [...initial.cutListResults, blockedOutput],
  });
  await expect(page.getByText("CutList unavailable: authored fades overlap.")).toBeVisible();
});

test("an entry fade keeps the recorded source extension after a trailing trim", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].entryTransition.id": "harbor-entry",
    "sequence.tracks[0].placements[0].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[0].entryTransition.durationFrames": 20,
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
      entryTransition: { id: "harbor-entry", kind: "fade", durationFrames: 20 },
    });
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await timeline.getByRole("button", { name: "Select entry fade: Harbor" }).click();
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
  await page.getByLabel("Entry fade duration (sequence frames)").fill("72");
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();
  await page.getByLabel("Reveal fade duration (sequence frames)").fill("48");
  await page.getByRole("button", { name: "Apply reveal fade", exact: true }).click();
  await expect(page.getByLabel("Reveal fade duration (sequence frames)")).toHaveValue("48");
  const initial = (await emissions())!;
  expect(initial.cutListResults).toHaveLength(2);
  expect(initial.cutListResults[1]).toHaveProperty("ok", true);
  const { entryTransition, revealTransition } = initial.sequences[1].tracks[0].placements[0];
  expect(entryTransition?.id).toEqual(expect.stringMatching(/\S/));
  expect(revealTransition?.id).toEqual(expect.stringMatching(/\S/));
  expect(entryTransition?.id).not.toBe(revealTransition?.id);

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
  await expect(page.getByLabel("Entry fade duration (sequence frames)")).toHaveValue("72");
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
