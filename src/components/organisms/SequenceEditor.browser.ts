import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import {
  compiled,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("dropping a pool clip in the existing gap emits the exact CutList", async ({ page }) => {
  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [
          { startFrame: 114, endFrame: 234 },
          { startFrame: 120, endFrame: 240 },
        ],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 621 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);

  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByText("Harbor", { exact: true });
  await expect(harbor).toHaveCount(2);
  await expect(timeline).not.toContainText("Lighthouse");

  const [source, left, right] = await Promise.all([
    lighthouse.boundingBox(),
    harbor.first().boundingBox(),
    harbor.last().boundingBox(),
  ]);
  if (!source || !left || !right || left.x + left.width >= right.x) {
    throw new Error("Expected a visible Lighthouse card and a gap between Harbor placements");
  }

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  async function drag(toX: number, toY: number) {
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 24 });
    // A second move over the target gives the browser another dragover before mouseup.
    await page.mouse.move(toX + 1, toY);
    await page.mouse.up();
  }

  const rowY = left.y + left.height / 2;
  // An occupied position is not a gap and must not commit an edit.
  await drag(left.x + left.width / 2, rowY);
  await expect(timeline).not.toContainText("Lighthouse");
  await drag((left.x + left.width + right.x) / 2, rowY);

  await expect
    .poll(async () => (await emissions()).cutListResults)
    .toStrictEqual([compiled(expected)]);
  await expect(timeline.getByText("Lighthouse", { exact: true })).toBeVisible();
  await expect(timeline).toContainText("Duration: 00:06");
});

test("adding at the start edge proposes one default entry fade and selects it on acceptance", async ({
  page,
}) => {
  const expectedSequence = {
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
            sequenceStartFrame: 120,
            entryTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 30 },
          },
        ],
      },
    ],
  };
  const expectedCutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 234 }],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 621 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 30 } },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(timeline).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await lighthouse.click({ timeout: 3_000 });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const indicator = timeline.getByText("Fade in", { exact: true });
  await expect(indicator).toHaveCount(0);
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Add transition" })
    .click();

  await expect(indicator).toBeVisible();
  await expect(
    timeline.getByRole("button", { name: "Select entry fade: Lighthouse" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("30");
  await expect(timeline.getByText("Transitions", { exact: true })).toHaveCount(0);
  const [placementBox, fadeBox] = await Promise.all([
    lighthouse.boundingBox(),
    indicator.boundingBox(),
  ]);
  if (!placementBox || !fadeBox) throw new Error("Expected a visible placement and fade marker");
  expect(fadeBox.y).toBeGreaterThanOrEqual(placementBox.y);
  expect(fadeBox.y + fadeBox.height).toBeLessThanOrEqual(placementBox.y + placementBox.height);
  expect(Math.abs(fadeBox.x - placementBox.x)).toBeLessThan(2);
  // The 30-frame fade spans one quarter of the 120-frame placement.
  expect(Math.abs(fadeBox.width - placementBox.width / 4)).toBeLessThan(2);
  expect(await emissions()).toStrictEqual({
    sequences: [expectedSequence],
    cutListResults: [compiled(expectedCutList)],
  });

  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await expect(indicator).toHaveCount(0);
  await expect(undo).toBeDisabled();
  await expect
    .poll(async () => (await emissions()).sequences)
    .toStrictEqual([
      expectedSequence,
      {
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
      },
    ]);
  await expect
    .poll(async () => (await emissions()).cutListResults)
    .toStrictEqual([
      compiled(expectedCutList),
      compiled({
        ...expectedCutList,
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
        ],
      }),
    ]);
});

test("adding at the end edge caps the reveal fade at the placement duration without moving the cut", async ({
  page,
}) => {
  const expectedSequence = {
    durationFrames: 144,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-open",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: -96,
            revealTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 24 },
          },
          { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 24 },
        ],
      },
    ],
  };
  const expectedCutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 138 }],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 621 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 24 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.durationFrames": 144,
    "sequence.tracks[0].placements[0].sourceOutOffsetFrames": -96,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 24,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();

  const inspector = page.getByRole("region", { name: "Inspector" });
  expect(await emissions()).toStrictEqual(noEdits);
  const indicator = timeline.getByText("Fade out", { exact: true });
  await expect(indicator).toHaveCount(0);
  await inspector
    .getByRole("group", { name: "End edge" })
    .getByRole("button", { name: "Add transition" })
    .click();

  await expect.poll(emissions).toStrictEqual({
    sequences: [expectedSequence],
    cutListResults: [compiled(expectedCutList)],
  });
  await expect(indicator).toBeVisible();
  await expect(
    timeline.getByRole("button", { name: "Select reveal fade: Harbor" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Edge: End", { exact: true })).toBeVisible();
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("24");
  await expect(timeline.getByText("Transitions", { exact: true })).toHaveCount(0);
  const [placementBox, fadeBox] = await Promise.all([
    harbor.boundingBox(),
    indicator.boundingBox(),
  ]);
  if (!placementBox || !fadeBox) throw new Error("Expected a visible placement and fade marker");
  expect(fadeBox.y).toBeGreaterThanOrEqual(placementBox.y);
  expect(fadeBox.y + fadeBox.height).toBeLessThanOrEqual(placementBox.y + placementBox.height);
  expect(Math.abs(fadeBox.x + fadeBox.width - (placementBox.x + placementBox.width))).toBeLessThan(
    2,
  );
  // The default is capped to fill, but not extend, this 24-frame placement.
  expect(fadeBox.width).toBeCloseTo(placementBox.width + 2, 0);
});

for (const { rate, expected, sourceOutOffset, secondStart, duration } of [
  { rate: [25, 1], expected: 13, sourceOutOffset: 0, secondStart: 50, duration: 100 },
  { rate: [1, 2], expected: 1, sourceOutOffset: 360, secondStart: 4, duration: 5 },
]) {
  test(`Add rounds half a second at ${rate.join("/")} fps to ${expected} whole sequence frames`, async ({
    page,
  }) => {
    const emissions = await recordEditorEmissions(page);
    await openWorkflow(page, roughCutStoryId, {
      ...straightCutArgs,
      "projectRate.numerator": rate[0],
      "projectRate.denominator": rate[1],
      "sequence.tracks[0].placements[0].sourceOutOffsetFrames": sourceOutOffset,
      "sequence.tracks[0].placements[1].sequenceStartFrame": secondStart,
      "sequence.durationFrames": duration,
    });
    await page
      .getByRole("region", { name: "Sequence timeline" })
      .getByRole("button", { name: "Harbor", exact: true })
      .click();
    const inspector = page.getByRole("region", { name: "Inspector" });
    await inspector
      .getByRole("group", { name: "End edge" })
      .getByRole("button", { name: "Add transition" })
      .click();
    await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue(String(expected));
    const { sequences, cutListResults } = await emissions();
    expect(sequences).toHaveLength(1);
    expect(sequences[0].tracks[0].placements[0].revealTransition).toEqual({
      id: expect.stringMatching(/\S/),
      kind: "fade",
      durationFrames: expected,
    });
    expect(cutListResults).toHaveLength(1);
  });
}
