import { expect, test, type Page } from "@playwright/test";
import {
  blockedOutput,
  compiled,
  noEdits,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

const pageStory = "examples-sequence-editor-composition--replace-page-slots";
const hookStory = "examples-sequence-editor-composition--assemble-with-the-hook";
const resizeStory = "examples-sequence-editor-composition--resize-a-transition";
const retainedStory = "examples-sequence-editor-composition--release-retained-placement-actions";

test("Storybook lists both composition examples separately from the default workflows", async ({
  request,
}) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const { entries } = await response.json();
  expect(entries[pageStory]).toMatchObject({ type: "story", name: "Replace page slots" });
  expect(entries[hookStory]).toMatchObject({ type: "story", name: "Assemble with the hook" });
});

test("replacement slots share a playhead and edits are immediately undoable", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${pageStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Frame-based timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Wrapped Inspector" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Pan left|Pan right|Zoom in|Zoom out|Fit to view)$/ }),
  ).toHaveCount(0);
  await timeline.getByLabel("Seek by sequence frame").fill("60");
  await expect(page.getByLabel("Timeline sequence frame")).toHaveText("60");
  await expect(page.getByLabel("Preview sequence frame")).toHaveText("60");
  expect(await emissions()).toEqual(noEdits);

  await timeline.getByRole("button", { name: "Preview placement" }).click();
  await expect(timeline.getByRole("status", { name: "Placement preview" })).toHaveText(
    "Fits at sequence frame 60",
  );
  expect(await emissions()).toEqual(noEdits);
  await timeline.getByRole("button", { name: "Place clip" }).click();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeEnabled();
  await expect(timeline.getByLabel("Placement count")).toHaveText("3");
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
              },
              { id: expect.any(String), clipId: "bridge", sequenceStartFrame: 60 },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 160 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/bridge.mp4",
            sections: [{ startFrame: 300, endFrame: 360 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      }),
    ],
  });
  await undo.click();
  const undone = await emissions();
  expect(undone.sequences).toHaveLength(2);
  expect(undone.sequences[1].tracks[0].placements.map(({ id }) => id)).toEqual([
    "opening",
    "closing",
  ]);
  expect(undone.cutListResults[1]).toEqual(blockedOutput);
});

test("the hook preserves working state until its caller opens a different key", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline
    .getByRole("button", { name: "Harbor", exact: true })
    .last()
    .click({ timeout: 20_000 });
  await timeline.getByRole("slider", { name: "Sequence playhead" }).press("End");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const frame = page.getByLabel("Sequence playhead position");
  await expect(frame).toHaveText("Sequence frame 240");
  await page.getByRole("button", { name: "Receive another saved snapshot" }).click();
  await expect(frame).toHaveText("Sequence frame 240");
  await expect(timeline.getByRole("button", { name: "Harbor", exact: true })).toHaveCount(1);
  await undo.click();
  await expect(timeline.getByRole("button", { name: "Harbor", exact: true })).toHaveCount(2);
  const beforeOpen = await emissions();
  await page.getByRole("button", { name: "Open saved snapshot" }).click();
  await expect(frame).toHaveText("Sequence frame 0");
  await expect(timeline.getByRole("button", { name: "Harbor", exact: true })).toHaveCount(0);
  await expect(undo).toBeDisabled();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(beforeOpen);
});

for (const direction of ["Undo", "Redo"] as const) {
  test(`${direction} refuses a target with a missing clip without consuming it`, async ({
    page,
  }) => {
    const emissions = await recordEditorEmissions(page);
    await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
    const timeline = page.getByRole("region", { name: "Sequence timeline" });
    await expect(timeline).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Place Bridge in gap" }).click();
    const bridge = timeline.getByRole("button", { name: "Bridge", exact: true });
    await expect(bridge).toBeVisible();
    const target = await emissions();
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const redo = page.getByRole("button", { name: "Redo", exact: true });
    const addTrack = page.getByRole("button", { name: "Add track", exact: true });
    if (direction === "Undo") {
      await bridge.click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await addTrack.click();
      await undo.click();
    } else {
      await bridge.click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await undo.click();
      await undo.click();
    }
    const step = direction === "Undo" ? undo : redo;
    await expect(bridge).toHaveCount(0);
    const before = await emissions();
    await page.getByRole("button", { name: "Remove Bridge from pool" }).click();
    await step.click();
    await expect(bridge).toHaveCount(0);
    expect(await emissions()).toEqual(before);
    if (direction === "Undo") await expect(redo).toBeEnabled();
    await page.getByRole("button", { name: "Restore Bridge to pool" }).click();
    await step.click();
    await expect(bridge).toBeVisible();
    expect(await emissions()).toEqual({
      sequences: [...before.sequences, ...target.sequences],
      cutListResults: [...before.cutListResults, ...target.cutListResults],
    });
    if (direction === "Redo") {
      await redo.click();
      await expect(bridge).toHaveCount(0);
    }
  });
}

test("a host-built toolbar exposes only actions from the mounted Timeline", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const host = page.getByRole("region", { name: "Host-built sequence editor" });
  const panLeft = host.getByRole("button", { name: "Pan left", exact: true });
  const panRight = host.getByRole("button", { name: "Pan right", exact: true });
  const zoomIn = host.getByRole("button", { name: "Zoom in", exact: true });
  const zoomOut = host.getByRole("button", { name: "Zoom out", exact: true });
  const fit = host.getByRole("button", { name: "Fit to view", exact: true });
  const replace = host.getByRole("button", { name: "Use a fit-only timeline" });
  await expect(panLeft).toBeVisible({ timeout: 20_000 });
  await expect(panRight).toBeVisible();
  await expect(zoomIn).toBeVisible();
  await expect(zoomOut).toBeVisible();
  await expect(fit).toBeVisible();
  await replace.click();
  await expect(panLeft).toHaveCount(0);
  await expect(panRight).toHaveCount(0);
  await expect(zoomIn).toHaveCount(0);
  await expect(zoomOut).toHaveCount(0);
  await fit.press("Enter");
  await expect(host.getByLabel("Fit requests")).toHaveText("1");
  await host.getByRole("button", { name: "Hide timeline", exact: true }).click();
  await expect(fit).toHaveCount(0);
  await host.getByRole("button", { name: "Show timeline", exact: true }).click();
  await expect(fit).toBeVisible();
  await expect(panLeft).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
});

test("the host-built editor emits nothing for blocked or cancelled Timeline moves", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const host = page.getByRole("region", { name: "Host-built sequence editor" });
  const timeline = host.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  const [first, last] = await timeline.getByRole("button", { name: "Harbor", exact: true }).all();
  const [opening, closing] = await Promise.all([first.boundingBox(), last.boundingBox()]);
  if (!opening || !closing) throw new Error("Expected both Harbor placements");
  const grip = { x: opening.x + 15, y: opening.y + opening.height / 2 };
  const pixelsPerFrame = (closing.x - opening.x) / 120;
  async function drag(offset: number) {
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + offset * pixelsPerFrame, grip.y, { steps: 12 });
  }

  await drag(95);
  await expect(timeline.getByRole("status")).toContainText("Blocked: Overlaps another placement");
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await drag(60);
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 60");
  await page.keyboard.press("Escape");
  await expect(timeline.getByRole("figure", { name: "Proposed placement: Harbor" })).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await expect(host.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("a host-built Timeline move survives a new array of equivalent clips", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 20_000 });
  const opening = (await harbor.first().boundingBox())!;
  const closing = (await harbor.last().boundingBox())!;
  const x = closing.x + closing.width / 3;
  const y = closing.y + closing.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (closing.x - opening.x) / 2, y, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 60");
  await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.up();
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 60,
                sourceOutOffsetFrames: 60,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 160 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      }),
    ],
  });
});

test("a host-built Timeline trim survives a new array of equivalent clips", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 20_000 });
  const opening = (await harbor.first().boundingBox())!;
  const closing = (await harbor.last().boundingBox())!;
  const trim = timeline.getByRole("button", { name: "Trim trailing edge: Harbor" }).first();
  const grip = (await trim.boundingBox())!;
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;
  // Extend the first placement from 60 to 120 frames, filling the gap.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (closing.x - opening.x) / 2, y, { steps: 12 });
  await expect(timeline.getByRole("figure", { name: "Proposed trim: Harbor" })).toBeVisible();
  await expect(timeline.getByRole("status")).toHaveText("Harbor · Sequence frame 120");
  await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.up();
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0, sourceOutOffsetFrames: 60 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 220 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      }),
    ],
  });
});

test("shifting a clip’s source range cancels a Timeline draft even when duration is unchanged", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 20_000 });
  const opening = (await harbor.first().boundingBox())!;
  const closing = (await harbor.last().boundingBox())!;
  const x = closing.x + closing.width / 3;
  const y = closing.y + closing.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (closing.x - opening.x) / 2, y, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 60");

  // A host can update clips while the editor still owns pointer capture.
  await page
    .getByRole("button", { name: "Host shifts Harbor source range" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(timeline.getByRole("status")).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await harbor.last().click();
  await expect(page.getByRole("region", { name: "Inspector" })).toContainText(
    "Source in/out (source frames): 102 inclusive – 222 exclusive",
  );
});

test("a replacement Timeline previews and resizes either transition kind by ID", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${resizeStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Frame-based timeline" });
  const duration = timeline.getByLabel("Proposed transition duration");
  const choice = timeline.getByLabel("Transition to resize");
  const preview = timeline.getByRole("status", { name: "Transition resize preview" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });

  await choice.selectOption({ label: "Fade — opening" });
  await duration.fill("12");
  await timeline.getByRole("button", { name: "Preview resize" }).click();
  await expect(preview).toHaveText("Fits at 12 sequence frames");
  expect(await emissions()).toEqual(noEdits);
  await timeline.getByRole("button", { name: "Resize transition" }).click();
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "opening",
                clipId: "harbor",
                sequenceStartFrame: 0,
                transitionIn: { id: "opening-fade", kind: "fade", durationFrames: 12 },
              },
              { id: "bridge", clipId: "bridge", sequenceStartFrame: 60 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
                transitionIn: { id: "closing-dissolve", kind: "dissolve", durationFrames: 6 },
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      { ok: false, issues: [{ code: "unsupported-dissolve", transitionId: "closing-dissolve" }] },
    ],
  });

  const afterFade = await emissions();
  await choice.selectOption({ label: "Dissolve — closing" });
  await duration.fill("9");
  await timeline.getByRole("button", { name: "Preview resize" }).click();
  await expect(preview).toHaveText("Fits at 9 sequence frames");
  expect(await emissions()).toEqual(afterFade);
  await timeline.getByRole("button", { name: "Resize transition" }).click();
  await expect
    .poll(async () => (await emissions()).sequences[1]?.tracks[0].placements)
    .toEqual([
      ...afterFade.sequences[0].tracks[0].placements.slice(0, 2),
      {
        id: "closing",
        clipId: "harbor",
        sequenceStartFrame: 120,
        sourceOutOffsetFrames: 60,
        transitionIn: { id: "closing-dissolve", kind: "dissolve", durationFrames: 9 },
      },
    ]);
  expect((await emissions()).cutListResults).toEqual([
    ...afterFade.cutListResults,
    { ok: false, issues: [{ code: "unsupported-dissolve", transitionId: "closing-dissolve" }] },
  ]);
});

test("a replacement Timeline release honors a lock committed after pointerdown", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${resizeStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Frame-based timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await timeline.getByLabel("Proposed transition duration").fill("12");
  await timeline.getByRole("button", { name: "Preview resize" }).click();
  const preview = timeline.getByRole("status", { name: "Transition resize preview" });
  await expect(preview).toHaveText("Fits at 12 sequence frames");

  const resize = timeline.getByRole("button", { name: "Resize transition" });
  await resize.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Lock Main", exact: true }).press("Space");
  const locked = await emissions();
  expect(locked.sequences).toHaveLength(1);
  expect(locked.sequences[0].tracks[0].locked).toBe(true);
  expect(locked.cutListResults).toHaveLength(1);
  await page.mouse.up();

  // Disappearance confirms that the custom Timeline ran its release action.
  await expect(preview).toHaveCount(0);
  expect(await emissions()).toEqual(locked);
  await timeline.getByRole("button", { name: "Preview resize" }).click();
  await expect(preview).toHaveText("blocked");
});

test("a retained pool drop honors an intervening destination track lock", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Retained placement actions" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  const capture = timeline.getByRole("button", { name: "Capture pool drop" });
  const release = timeline.getByRole("button", { name: "Release retained action" });
  await capture.click();
  await expect(release).toBeEnabled();

  await page.getByRole("button", { name: "Lock Main", exact: true }).click();
  await expect(capture).toBeDisabled();
  const locked = await emissions();
  expect(locked.sequences).toHaveLength(1);
  expect(locked.cutListResults).toHaveLength(1);

  await release.click();
  await expect(release).toBeDisabled();
  expect(await emissions()).toEqual(locked);
});

test("a retained placement move preserves an intervening placement and compiles the edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Retained placement actions" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await timeline.getByRole("button", { name: "Capture placement move" }).click();
  await page.getByRole("button", { name: "Place Bridge in Reserve" }).click();
  const before = await emissions();
  expect(before.sequences).toHaveLength(1);
  expect(before.cutListResults).toHaveLength(1);

  await timeline.getByRole("button", { name: "Release retained action" }).click();
  expect(await emissions()).toEqual({
    sequences: [
      ...before.sequences,
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 60,
                sourceOutOffsetFrames: 60,
              },
            ],
          },
          {
            id: "reserve",
            label: "Reserve",
            placements: [{ id: expect.any(String), clipId: "bridge", sequenceStartFrame: 180 }],
          },
          { id: "bridge-track", label: "Bridge", placements: [] },
        ],
      },
    ],
    cutListResults: [
      ...before.cutListResults,
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 160 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/bridge.mp4",
            sections: [{ startFrame: 300, endFrame: 360 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
          { mediaIndex: 1, sectionIndex: 0 },
        ],
      }),
    ],
  });
});

test("a retained placement trim preserves an intervening trim on the other placement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Retained placement actions" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await timeline.getByRole("button", { name: "Capture placement trim" }).click();
  await page.getByRole("button", { name: "Trim Closing to source frame 222" }).click();
  const before = await emissions();
  expect(before.sequences).toHaveLength(1);
  expect(before.cutListResults).toHaveLength(1);

  await timeline.getByRole("button", { name: "Release retained action" }).click();
  expect(await emissions()).toEqual({
    sequences: [
      ...before.sequences,
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "opening",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 60,
              },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 62,
              },
            ],
          },
          { id: "reserve", label: "Reserve", placements: [] },
          { id: "bridge-track", label: "Bridge", placements: [] },
        ],
      },
    ],
    cutListResults: [
      ...before.cutListResults,
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 220 },
              { startFrame: 100, endFrame: 222 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      }),
    ],
  });
});

test("a retained Split activation honors a track lock added after pointerdown", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const activate = page.getByRole("button", { name: "Activate Opening at frame 30" });
  await expect(activate).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Split mode" }).click();
  await activate.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Lock Main", exact: true }).press("Space");
  const locked = await emissions();
  expect(locked.sequences).toHaveLength(1);
  expect(locked.cutListResults).toHaveLength(1);

  await page.mouse.up();
  expect(await emissions()).toEqual(locked);
  await expect(page.getByText("Blocked: the track is locked.")).toBeVisible();
});

test("a retained Split activation selects after Split mode is turned off", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const activate = page.getByRole("button", { name: "Activate Opening at frame 30" });
  await expect(activate).toBeVisible({ timeout: 20_000 });
  const split = page.getByRole("button", { name: "Split mode" });
  await split.click();
  await activate.hover();
  await page.mouse.down();
  await split.press("Space");
  await expect(split).toHaveAttribute("aria-pressed", "false");

  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Placement Properties" })).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
});

test("a retained Split preserves an intervening placement and compiles the edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const activate = page.getByRole("button", { name: "Activate Opening at frame 30" });
  await expect(activate).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Split mode" }).click();
  await activate.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Place Bridge in Bridge track" }).press("Space");
  const before = await emissions();
  expect(before.sequences).toHaveLength(1);
  expect(before.cutListResults).toHaveLength(1);

  await page.mouse.up();
  expect(await emissions()).toEqual({
    sequences: [
      ...before.sequences,
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "opening",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -30,
              },
              {
                id: expect.any(String),
                clipId: "harbor",
                sequenceStartFrame: 30,
                sourceInOffsetFrames: 30,
              },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
              },
            ],
          },
          { id: "reserve", label: "Reserve", placements: [] },
          {
            id: "bridge-track",
            label: "Bridge",
            placements: [{ id: expect.any(String), clipId: "bridge", sequenceStartFrame: 60 }],
          },
        ],
      },
    ],
    cutListResults: [
      ...before.cutListResults,
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 130 },
              { startFrame: 130, endFrame: 160 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/bridge.mp4",
            sections: [{ startFrame: 300, endFrame: 360 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 2 },
        ],
      }),
    ],
  });
});

test("a retained Reorder moves a locked track, preserving an intervening placement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const reorder = page.getByRole("button", { name: "Reorder Main to Reserve" });
  await expect(reorder).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Place Bridge in Reserve" }).click();
  await page.getByRole("button", { name: "Lock Main", exact: true }).click();
  await reorder.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Place Bridge in Bridge track" }).press("Space");
  const before = await emissions();
  expect(before.sequences).toHaveLength(3);
  expect(before.cutListResults).toHaveLength(3);

  await page.mouse.up();
  expect(await emissions()).toEqual({
    sequences: [
      ...before.sequences,
      {
        tracks: [
          {
            id: "reserve",
            label: "Reserve",
            placements: [{ id: expect.any(String), clipId: "bridge", sequenceStartFrame: 180 }],
          },
          {
            id: "main",
            label: "Main",
            locked: true,
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
              },
            ],
          },
          {
            id: "bridge-track",
            label: "Bridge",
            placements: [{ id: expect.any(String), clipId: "bridge", sequenceStartFrame: 60 }],
          },
        ],
      },
    ],
    cutListResults: [
      ...before.cutListResults,
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 100, endFrame: 160 },
              { startFrame: 100, endFrame: 160 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/bridge.mp4",
            sections: [
              { startFrame: 300, endFrame: 360 },
              { startFrame: 300, endFrame: 360 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
          { mediaIndex: 1, sectionIndex: 1 },
        ],
      }),
    ],
  });
});

test("a retained Reorder cannot restore a destination track removed by another edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const reorder = page.getByRole("button", { name: "Reorder Main to Reserve" });
  await reorder.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Remove Reserve" }).press("Space");
  const before = await emissions();
  expect(before.sequences).toHaveLength(1);
  expect(before.cutListResults).toHaveLength(1);

  await page.mouse.up();
  await expect(reorder).toBeDisabled();
  expect(await emissions()).toEqual(before);
});

async function openPasteDrop(page: Page) {
  await page.goto(`/iframe.html?id=${retainedStory}&viewMode=story`);
  const activate = page.getByRole("button", { name: "Activate Opening at frame 30" });
  await expect(activate).toBeVisible({ timeout: 20_000 });
  await activate.click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const drop = page.getByText("Paste drop active");
  const confirm = page.getByRole("button", { name: "Confirm Paste at frame 60" });
  await expect(drop).toBeVisible();
  return { drop, confirm };
}

test("a retained Paste confirmation emits nothing after Escape cancels the drop", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const { drop, confirm } = await openPasteDrop(page);
  await confirm.hover();
  await page.mouse.down();
  await page.keyboard.press("Escape");
  await expect(drop).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);

  await page.mouse.up();
  await expect(confirm).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("a retained Paste confirmation cannot use a superseding drop session", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  const { drop, confirm } = await openPasteDrop(page);
  await confirm.hover();
  await page.mouse.down();
  await page.keyboard.press("Control+v");
  await expect(drop).toBeVisible();

  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await expect(drop).toBeVisible();
  await confirm.click();
  await expect(drop).toHaveCount(0);
  const result = await emissions();
  expect(result.sequences).toHaveLength(1);
  expect(result.sequences[0].tracks[0].placements.at(-1)).toEqual({
    id: expect.any(String),
    clipId: "harbor",
    sequenceStartFrame: 60,
  });
  expect(result.cutListResults).toHaveLength(1);
  expect(result.cutListResults[0].ok).toBe(true);
});

test("a retained Paste confirmation cannot revive the clipboard after a host replacement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const { drop, confirm } = await openPasteDrop(page);
  await confirm.hover();
  await page.mouse.down();
  await page.getByRole("button", { name: "Reopen sequence" }).press("Space");
  await expect(drop).toHaveCount(0);

  await page.mouse.up();
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "Activate Opening at frame 30" }).press("Control+v");
  await expect(drop).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
});

test("a retained Paste confirmation revalidates the same drop after an acknowledged lock", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const { drop, confirm } = await openPasteDrop(page);
  await confirm.hover();
  await page.mouse.down();
  const lock = page.getByRole("button", { name: "Lock Main", exact: true });
  const unlock = page.getByRole("button", { name: "Unlock Main", exact: true });
  await lock.press("Space");
  await expect(unlock).toBeVisible();
  const lockEdit = await emissions();
  expect(lockEdit.sequences).toHaveLength(1);
  expect(lockEdit.sequences[0].tracks[0].locked).toBe(true);
  expect(lockEdit.cutListResults).toHaveLength(1);

  await page.mouse.up();
  expect(await emissions()).toEqual(lockEdit);
  await expect(drop).toBeVisible();
});
