import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  blockedOutput,
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

const [cutaways, main, alternate] = [
  {
    id: "cutaways",
    label: "Cutaways",
    placements: [
      {
        id: "lighthouse-open",
        clipId: "lighthouse",
        sequenceStartFrame: 0,
        sourceOutOffsetFrames: -60,
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
        sequenceStartFrame: 0,
        sourceOutOffsetFrames: 120,
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
        sequenceStartFrame: 120,
        sourceInOffsetFrames: 6,
        sourceOutOffsetFrames: -6,
      },
    ],
  },
] satisfies Sequence["tracks"];

const original: Sequence = { durationFrames: 240, tracks: [cutaways, main, alternate] };
const cutawaysFirst: CutList = {
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
    { mediaIndex: 0, sectionIndex: 0 },
    { mediaIndex: 1, sectionIndex: 0 },
  ],
};
// Harbor supplies the entire sequence, including the [0, 60) overlap.
const mainFirst: CutList = {
  version: "1.0.0",
  inputMedia: [
    {
      s3Location: "s3://sequence-fixtures/harbor.mp4",
      sections: [{ startFrame: 114, endFrame: 354 }],
    },
  ],
  outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
};

function reorderHandle(timeline: Locator, track: string) {
  return timeline.getByRole("button", { name: `Reorder track: ${track}`, exact: true });
}

async function dragTrack(page: Page, timeline: Locator, from: string, to: string) {
  const handle = reorderHandle(timeline, from);
  await expect(handle).toBeVisible({ timeout: 2_000 });
  await handle.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!;
  const end = (await reorderHandle(timeline, to).boundingBox())!;
  const origin = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x, end.y + end.height / 2, { steps: 10 });
  return origin;
}

test("a track drag previews its destination and commits the new top-first priority only on drop", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const handles = timeline.getByRole("button", { name: /^Reorder track:/ });
  const preview = timeline.getByRole("status");
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const harborBefore = (await harbor.boundingBox())!;
  await dragTrack(page, timeline, "Cutaways", "Alternate");
  await expect(preview).toHaveText("Position 3 of 3");
  await expect(handles.first()).toHaveAccessibleName("Reorder track: Cutaways");
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect(handles.first()).toHaveAccessibleName("Reorder track: Main");
  await expect(handles.last()).toHaveAccessibleName("Reorder track: Cutaways");
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await harbor.boundingBox())!.y).toBeLessThan(harborBefore.y);
  const reordered = { ...original, tracks: [main, alternate, cutaways] };
  expect(await emissions()).toStrictEqual({
    sequences: [reordered],
    cutListResults: [compiled(mainFirst)],
  });

  await undo.click();
  await expect(handles.first()).toHaveAccessibleName("Reorder track: Cutaways");
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual({
    sequences: [reordered, original],
    cutListResults: [compiled(mainFirst), compiled(cutawaysFirst)],
  });
});

test("without host acceptance a reorder proposes both outputs but does not replace the sequence", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, { acceptEdits: "!false" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await dragTrack(page, timeline, "Main", "Cutaways");
  await expect(timeline.getByRole("status")).toHaveText("Position 1 of 3");
  await page.mouse.up();
  await expect(timeline.getByRole("status")).toHaveCount(0);
  expect(await emissions()).toStrictEqual({
    sequences: [{ ...original, tracks: [main, cutaways, alternate] }],
    cutListResults: [compiled(mainFirst)],
  });
  await expect(
    timeline.getByRole("button", { name: /^Reorder track:/ }).first(),
  ).toHaveAccessibleName("Reorder track: Cutaways");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("Escape, a return to the starting position, and a drop outside the track list do not edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const preview = timeline.getByRole("status");

  await dragTrack(page, timeline, "Main", "Cutaways");
  await expect(preview).toHaveText("Position 1 of 3");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0, { timeout: 2_000 });
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);

  const origin = await dragTrack(page, timeline, "Main", "Cutaways");
  await expect(preview).toHaveText("Position 1 of 3");
  await page.mouse.move(origin.x, origin.y);
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);

  await dragTrack(page, timeline, "Main", "Cutaways");
  const above = (await reorderHandle(timeline, "Cutaways").boundingBox())!;
  const outside = (await timeline
    .getByRole("button", { name: "Harbor", exact: true })
    .boundingBox())!;
  await page.mouse.move(outside.x + 8, above.y + above.height / 2);
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(
    timeline.getByRole("button", { name: /^Reorder track:/ }).first(),
  ).toHaveAccessibleName("Reorder track: Cutaways");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("reorder keeps an exposed interrupted fade, explains the unavailable CutList and can be undone", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const fade = { id: "alternate-entry", kind: "fade", durationFrames: 40 } as const;
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[2].placements[0].sequenceStartFrame": 40,
    "sequence.tracks[2].placements[0].entryTransition.id": fade.id,
    "sequence.tracks[2].placements[0].entryTransition.kind": fade.kind,
    "sequence.tracks[2].placements[0].entryTransition.durationFrames": fade.durationFrames,
  });
  const alternateWithFade = {
    ...alternate,
    placements: [{ ...alternate.placements[0], sequenceStartFrame: 40, entryTransition: fade }],
  };
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const unavailable = page.getByText(
    "CutList unavailable: an authored fade crosses a visible cut.",
  );
  await expect(unavailable).toBeHidden();

  // Main covers the entire [40, 80) fade before the move. Afterwards Cutaways
  // covers just [40, 60), exposing the rest of the fade without its entry edge.
  await dragTrack(page, timeline, "Main", "Alternate");
  await expect(timeline.getByRole("status")).toHaveText("Position 3 of 3");
  await expect(unavailable).toBeHidden();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  const reordered = { ...original, tracks: [cutaways, alternateWithFade, main] };
  await expect(unavailable).toBeVisible();
  expect(await emissions()).toStrictEqual({
    sequences: [reordered],
    cutListResults: [blockedOutput],
  });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(unavailable).toBeHidden();
  expect(await emissions()).toStrictEqual({
    sequences: [reordered, { ...original, tracks: [cutaways, main, alternateWithFade] }],
    cutListResults: [blockedOutput, compiled(cutawaysFirst)],
  });
});
