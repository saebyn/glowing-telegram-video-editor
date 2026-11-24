import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import {
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("the Inspector shows the selected placement's effective source in and out frames", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbors).toHaveCount(2, { timeout: 20_000 });
  await harbors.last().click();

  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  await expect(inspector.getByRole("heading", { name: "Inspector", exact: true })).toBeVisible();
  // This placement starts and ends six native frames later than the reusable clip.
  await expect(
    inspector.getByText("Source in/out (source frames): 120 inclusive – 240 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("the Inspector shows sequence start and end on the project frame grid", async ({ page }) => {
  // Trim 60 frames from the end of the last Harbor via the story's public sequence arg.
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": -54,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbors).toHaveCount(2, { timeout: 20_000 });
  await harbors.last().click();

  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  await expect(
    inspector.getByText("Sequence start/end (sequence frames): 240 inclusive – 300 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    inspector.getByText("Source in/out (source frames): 120 inclusive – 180 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
});

test("the Inspector can switch between placements of the same clip without editing or changing the selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[0].label": "Cutaways",
    "sequence.tracks[2].label": "Cutaways",
    "sequence.tracks[2].placements[0].sequenceStartFrame": 0,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });

  await lighthouses.first().click();
  await lighthouses.last().click({ modifiers: ["Shift"] });
  await expect(inspector.getByText("2 placements selected")).toBeVisible();
  const target = inspector.getByRole("combobox", { name: "Inspect placement", exact: true });
  await expect(target.getByRole("option")).toHaveText([
    "Lighthouse — Cutaways (track 1), sequence frame 0",
    "Lighthouse — Cutaways (track 3), sequence frame 0",
  ]);
  await expect(
    inspector.getByText("Source in/out (source frames): 501 inclusive – 561 exclusive"),
  ).toBeVisible();

  await target.selectOption({ label: "Lighthouse — Cutaways (track 3), sequence frame 0" });
  await expect(
    inspector.getByText("Source in/out (source frames): 507 inclusive – 615 exclusive"),
  ).toBeVisible();
  await expect(
    inspector.getByText("Sequence start/end (sequence frames): 0 inclusive – 108 exclusive"),
  ).toBeVisible();
  await expect(inspector.getByText("2 placements selected")).toBeVisible();
  await expect(lighthouses.first()).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouses.last()).toHaveAttribute("aria-pressed", "true");
  await expect(timeline.getByRole("button", { name: "Harbor", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("removing the Inspector target falls back to a selected placement without reviving the old target on re-add", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  const target = inspector.getByRole("combobox", { name: "Inspect placement", exact: true });
  const currentOption = target.getByRole("option", { selected: true });
  const alternateLabel = "Lighthouse — Alternate, sequence frame 120";
  const cutawaysLabel = "Lighthouse — Cutaways, sequence frame 0";

  await lighthouses.first().click();
  await harbor.click({ modifiers: ["Shift"] });
  await lighthouses.last().click({ modifiers: ["Shift"] });
  await target.selectOption({ label: alternateLabel });
  const alternateRange = inspector.getByText(
    "Source in/out (source frames): 507 inclusive – 615 exclusive",
  );
  await expect(alternateRange).toBeVisible();

  await lighthouses.last().click({ modifiers: ["Shift"] });
  await expect(inspector.getByText("2 placements selected")).toBeVisible();
  await expect(target.getByRole("option", { name: alternateLabel })).toHaveCount(0);
  await expect(currentOption).toHaveText(cutawaysLabel);
  await expect(alternateRange).toHaveCount(0);
  await expect(
    inspector.getByText("Source in/out (source frames): 501 inclusive – 561 exclusive"),
  ).toBeVisible();

  await lighthouses.last().click({ modifiers: ["Shift"] });
  await expect(inspector.getByText("3 placements selected")).toBeVisible();
  await expect(currentOption).toHaveText(cutawaysLabel);
  await expect(alternateRange).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("the occupied edge and timeline both inspect a transition without editing or retaining a placement selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-fade",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 30,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const indicator = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  const chooser = inspector.getByRole("combobox", { name: "Inspect placement" });
  const enter = inspector.getByRole("group", { name: "Start edge" });
  const properties = inspector.getByRole("heading", { name: "Transition Properties" });
  const duration = inspector.getByRole("spinbutton", {
    name: "Duration (sequence frames)",
  });

  for (const inspect of [enter.getByRole("button", { name: "Inspect transition" }), indicator]) {
    await harbor.click();
    await lighthouse.click({ modifiers: ["Shift"] });
    await chooser.selectOption({ label: "Lighthouse — Main, sequence frame 120" });
    await expect(inspector.getByRole("heading", { name: "Placement Properties" })).toBeVisible();
    await expect(duration).toHaveCount(0);
    await inspect.click();
    await expect(properties).toBeVisible();
    await expect(inspector.getByText("Owner: Lighthouse — Main, sequence frame 120")).toBeVisible();
    await expect(inspector.getByText("Edge: Start", { exact: true })).toBeVisible();
    await expect(duration).toHaveValue("30");
    await expect(chooser).toHaveCount(0);
    await expect(inspector.getByRole("heading", { name: "Placement Properties" })).toHaveCount(0);
    await expect(
      inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" }),
    ).toHaveCount(0);
    await expect(indicator).toHaveAttribute("aria-pressed", "true");
    await expect(harbor).toHaveAttribute("aria-pressed", "false");
    await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
    expect(await emissions()).toStrictEqual(noEdits);
  }
});

test("a read-only sequence allows occupied-edge inspection but no transition edits", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    readOnly: "true",
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-fade",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 30,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const indicator = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await lighthouse.click({ timeout: 5_000 });
  await expect(
    inspector
      .getByRole("group", { name: "End edge" })
      .getByRole("button", { name: "Add transition" }),
  ).toBeDisabled();
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Inspect transition" })
    .click();
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(indicator).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect(inspector.getByRole("spinbutton")).toHaveCount(0);
  await expect(inspector.getByRole("combobox", { name: "Type" })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Remove transition" })).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("inspecting an occupied edge in Split mode highlights the fade without enabling its timeline button", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-fade",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 30,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const fadeLabel = timeline.getByText("Fade in", { exact: true });
  const splitMode = page.getByRole("button", { name: "Split mode", exact: true });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  await splitMode.click();
  await expect(splitMode).toHaveAttribute("aria-pressed", "true");
  await expect(fadeLabel).toBeVisible();
  const unselectedColor = await fadeLabel.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Inspect transition" })
    .click();
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(fadeLabel).not.toHaveCSS("background-color", unselectedColor);
  await expect(timeline.getByRole("button", { name: "Select entry fade: Lighthouse" })).toHaveCount(
    0,
  );
  await expect(splitMode).toHaveAttribute("aria-pressed", "true");
  const selectedColor = await fadeLabel.evaluate((node) => getComputedStyle(node).backgroundColor);
  await splitMode.click();
  await expect(
    timeline.getByRole("button", { name: "Select entry fade: Lighthouse" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(fadeLabel).toHaveCSS("background-color", selectedColor);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a pending or rejected Add proposal leaves Placement Properties and history unchanged", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { ...straightCutArgs, reviewEdits: "true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const fade = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const add = inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Add transition" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  async function expectPlacementProperties() {
    await expect(inspector.getByRole("heading", { name: "Placement Properties" })).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toHaveCount(0);
    await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
    await expect(undo).toBeDisabled();
    await expect(fade).toHaveCount(0);
  }

  await lighthouse.click();
  await add.click();
  const reject = page.getByRole("button", { name: "Reject proposed edit" });
  await expect(reject).toBeVisible();
  await expectPlacementProperties();
  const first = await emissions();
  expect(first.sequences).toHaveLength(1);
  expect(first.cutListResults).toHaveLength(1);
  await reject.click();
  await expect(reject).toHaveCount(0);
  await expectPlacementProperties();
  expect(await emissions()).toStrictEqual(first);

  await add.click();
  const accept = page.getByRole("button", { name: "Accept proposed edit" });
  await expect(accept).toBeVisible();
  await expectPlacementProperties();
  const second = await emissions();
  expect(second.sequences).toHaveLength(2);
  expect(second.cutListResults).toHaveLength(2);
  await accept.click();
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(undo).toBeEnabled();
  expect(await emissions()).toStrictEqual(second);
});

test("a conflicting Add does not shorten the default to fit or clear the selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].revealTransition.id": "harbor-reveal",
    "sequence.tracks[0].placements[0].revealTransition.kind": "fade",
    "sequence.tracks[0].placements[0].revealTransition.durationFrames": 96,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const rect = (await harbor.boundingBox())!;
  await harbor.click({ position: { x: rect.width / 2, y: rect.height - 4 } });
  await lighthouse.click({ modifiers: ["Shift"] });
  await expect(inspector.getByRole("combobox", { name: "Inspect placement" })).toHaveValue(
    "harbor-open",
  );

  // The reveal occupies the last 96 of 120 frames, leaving 24 for a 30-frame default.
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Add transition" })
    .click();
  await expect(inspector.getByRole("alert")).toContainText("competes with another transition");
  await expect(inspector.getByText("2 placements selected")).toBeVisible();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await expect(timeline.getByRole("button", { name: "Select entry fade: Harbor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("Inspector trims and fades apply only to the inspected placement in the selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  const target = inspector.getByRole("combobox", { name: "Inspect placement", exact: true });
  const sourceOut = inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" });

  await harbor.click();
  await lighthouse.click({ modifiers: ["Shift"] });
  // A draft for Harbor must not carry over to Lighthouse.
  await sourceOut.fill("215");
  await target.selectOption({ label: "Lighthouse — Main, sequence frame 120" });
  await expect(sourceOut).toHaveValue("621");
  expect(await emissions()).toStrictEqual(noEdits);

  await sourceOut.fill("631");
  await inspector.getByRole("button", { name: "Trim placement", exact: true }).click();
  await expect(
    inspector.getByText("Sequence start/end (sequence frames): 120 inclusive – 250 exclusive"),
  ).toBeVisible();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Add transition" })
    .click();
  const transition = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await expect(transition).toBeVisible();

  const trimmed = {
    durationFrames: 250,
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
            sourceOutOffsetFrames: 10,
          },
        ],
      },
    ],
  };
  const cut: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 234 }],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 631 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  const faded = structuredClone(trimmed);
  Object.assign(faded.tracks[0].placements[1], {
    entryTransition: { id: expect.stringMatching(/\S/), kind: "fade", durationFrames: 30 },
  });
  const cutWithFade: CutList = {
    ...cut,
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 30 } },
    ],
  };
  const expectedEmissions = {
    sequences: [trimmed, faded],
    cutListResults: [compiled(cut), compiled(cutWithFade)],
  };
  await expect.poll(emissions).toStrictEqual(expectedEmissions);
  await expect(transition).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Owner: Lighthouse — Main, sequence frame 120")).toBeVisible();
  await expect(target).toHaveCount(0);
  await expect(sourceOut).toHaveCount(0);
  await expect(harbor).toHaveAttribute("aria-pressed", "false");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  expect(await emissions()).toStrictEqual(expectedEmissions);
});
