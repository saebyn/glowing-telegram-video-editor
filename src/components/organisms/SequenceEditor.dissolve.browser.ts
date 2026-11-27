import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Sequence } from "@/types";
import {
  blockedOutput,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

const incomingDissolveArgs = {
  ...straightCutArgs,
  "sequence.tracks[0].placements[1].transitionIn.id": "incoming-dissolve",
  "sequence.tracks[0].placements[1].transitionIn.kind": "dissolve",
  "sequence.tracks[0].placements[1].transitionIn.durationFrames": 7,
};

function incomingDissolveSequence(durationFrames: number): Sequence {
  return {
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
            transitionIn: { id: "incoming-dissolve", kind: "dissolve", durationFrames },
          },
        ],
      },
    ],
  };
}

const unsupportedDissolve = {
  ok: false,
  issues: [{ code: "unsupported-dissolve", transitionId: "incoming-dissolve" }],
};

async function dragHandle(page: Page, handle: Locator, offsetX: number) {
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + offsetX, y, { steps: 8 });
}

test("a dissolve drag previews a centered odd window and commits one undoable edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, incomingDissolveArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const indicator = timeline.getByRole("button", { name: "Select dissolve: Lighthouse" });
  const handle = timeline.getByRole("button", { name: "Adjust dissolve: Lighthouse" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await indicator.click();
  await expect(indicator).toHaveAttribute("aria-pressed", "true");
  const before = (await lighthouse.boundingBox())!;
  const initialWindow = (await indicator.boundingBox())!;
  const frameWidth = (before.width + 2) / 120;
  await expect(indicator).toHaveAttribute("title", /^Dissolve: sequence frames \[117, 124\)/);

  // Extending the right side by 4 frames also extends the left by 4: [113, 128).
  await dragHandle(page, handle, 4 * frameWidth);
  await expect(indicator).toHaveAttribute("title", "Dissolve: sequence frames [113, 128)");
  const preview = (await indicator.boundingBox())!;
  expect(preview.x).toBeCloseTo(initialWindow.x - 4 * frameWidth, 0);
  expect(preview.width).toBeCloseTo(15 * frameWidth, 0);
  expect(await lighthouse.boundingBox()).toMatchObject({ x: before.x, width: before.width });
  expect(await emissions()).toEqual(noEdits);
  await expect(undo).toBeDisabled();
  await page.mouse.up();

  const duration = page.getByLabel("Duration (sequence frames)");
  await expect(duration).toHaveValue("15");
  await expect.poll(emissions).toStrictEqual({
    sequences: [incomingDissolveSequence(15)],
    cutListResults: [unsupportedDissolve],
  });
  await expect(indicator).toHaveAttribute("title", /^Dissolve: sequence frames \[113, 128\)/);
  await undo.click();
  await expect(duration).toHaveValue("7");
  await expect(indicator).toHaveAttribute("title", /^Dissolve: sequence frames \[117, 124\)/);
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual({
    sequences: [incomingDissolveSequence(15), incomingDissolveSequence(7)],
    cutListResults: [unsupportedDissolve, unsupportedDissolve],
  });
});

test("resizing a dissolve into another transition stays blocked and does not emit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...incomingDissolveArgs,
    "sequence.tracks[0].placements[0].transitionIn.id": "opening-fade",
    "sequence.tracks[0].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[0].transitionIn.durationFrames": 110,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const dissolve = timeline.getByRole("button", { name: "Select dissolve: Lighthouse" });
  const handle = timeline.getByRole("button", { name: "Adjust dissolve: Lighthouse" });
  await dissolve.click();
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const { width } = (await lighthouse.boundingBox())!;

  // The proposed window [109, 132) overlaps the opening fade [0, 110).
  await dragHandle(page, handle, ((width + 2) * 8) / 120);
  await expect(handle).toHaveAccessibleDescription(
    "This transition competes with another transition on the same cut or visible frames.",
  );
  await expect(dissolve).toHaveAttribute("title", /^Dissolve: sequence frames \[117, 124\)/);
  await page.mouse.up();
  await expect(handle).not.toHaveAccessibleDescription(/competes/);
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("7");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("Escape cancels a dissolve resize at the sequence boundary", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": -4,
    "sequence.tracks[0].placements[1].transitionOut.id": "closing-dissolve",
    "sequence.tracks[0].placements[1].transitionOut.kind": "dissolve",
    "sequence.tracks[0].placements[1].transitionOut.durationFrames": 11,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const indicator = timeline.getByRole("button", { name: "Select dissolve: Lighthouse" });
  const handle = timeline.getByRole("button", { name: "Adjust dissolve: Lighthouse" });
  await indicator.click();
  const { width } = (await timeline
    .getByRole("button", { name: "Lighthouse", exact: true })
    .boundingBox())!;
  // The cut is at 236 and the right side is clipped. Drag the left grip
  // four frames earlier, extending the authored 11-frame window to 19.
  await dragHandle(page, handle, -((width + 2) * 4) / 116);
  await expect(indicator).toHaveAttribute("title", "Dissolve: sequence frames [227, 236)");
  await page.keyboard.press("Escape");
  await expect(indicator).toHaveAttribute("title", /^Dissolve: sequence frames \[231, 236\)/);
  await page.mouse.up();
  await expect(page.getByLabel("Duration (sequence frames)")).toHaveValue("11");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("Dissolve remains visible without a resize handle in Split mode and on a locked track", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const indicator = timeline.getByText("Dissolve", { exact: true });
  const handle = timeline.getByRole("button", { name: "Adjust dissolve: Lighthouse" });
  await openWorkflow(page, roughCutStoryId, incomingDissolveArgs);
  await expect(handle).toBeVisible();
  await page.getByRole("button", { name: "Split mode", exact: true }).click();
  await expect(indicator).toBeVisible();
  await expect(handle).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);

  await openWorkflow(page, roughCutStoryId, {
    ...incomingDissolveArgs,
    "sequence.tracks[0].locked": "true",
  });
  await expect(indicator).toBeVisible();
  await expect(handle).toHaveCount(0);
  await timeline.getByRole("button", { name: "Select dissolve: Lighthouse" }).click();
  await expect(page.getByText("7 sequence frames", { exact: true })).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
});

test("Transition Properties resolves an authored odd dissolve and can resize it without changing the cut or trims", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, incomingDissolveArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const indicator = timeline.getByRole("button", { name: "Select dissolve: Lighthouse" });
  await expect(indicator).toHaveAttribute("title", /^Dissolve: sequence frames \[117, 124\)/);
  await indicator.click();
  const before = (await lighthouse.boundingBox())!;
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(inspector.getByRole("option", { name: "Dissolve", exact: true })).toHaveCount(1);
  await expect(inspector.getByLabel("Duration (sequence frames)")).toHaveValue("7");
  await inspector.getByLabel("Duration (sequence frames)").fill("9");
  expect(await emissions()).toEqual(noEdits);
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(emissions).toEqual({
    sequences: [incomingDissolveSequence(9)],
    cutListResults: [unsupportedDissolve],
  });
  await expect(indicator).toHaveAttribute(
    "title",
    /Outgoing extension: source frames \[234, 239\)/,
  );
  await expect(indicator).toHaveAttribute(
    "title",
    /Incoming extension: source frames \[497, 501\)/,
  );
  await expect(indicator).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Owner: Lighthouse — Main, sequence frame 120")).toBeVisible();
  await expect(inspector.getByText("Dissolve window: 116 inclusive – 125 exclusive")).toBeVisible();
  await expect(
    inspector.getByText("Outgoing extension: 234 inclusive – 239 exclusive"),
  ).toBeVisible();
  await expect(
    inspector.getByText("Incoming extension: 497 inclusive – 501 exclusive"),
  ).toBeVisible();
  await expect(
    page.getByText("CutList unavailable: the format cannot represent a dissolve."),
  ).toBeVisible();
  expect(await lighthouse.boundingBox()).toMatchObject({ x: before.x, width: before.width });
});

test("adding a fade at a cut already owned by a dissolve explains the conflict without switching views", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].transitionIn.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].transitionIn.kind": "dissolve",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 9,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await inspector
    .getByRole("group", { name: "End edge" })
    .getByRole("button", { name: "Add transition" })
    .click();
  await expect(inspector.getByRole("alert")).toContainText("competes with another transition");
  await expect(inspector.getByRole("heading", { name: "Placement Properties" })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Harbor", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await emissions()).toEqual(noEdits);
  await expect(timeline.getByRole("button", { name: /Select dissolve/ })).toHaveCount(1);
});

test("resizing a host-authored dissolve cannot commit while another dissolve owns the same cut", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionOut.id": "outgoing-dissolve",
    "sequence.tracks[0].placements[0].transitionOut.kind": "dissolve",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 8,
    "sequence.tracks[0].placements[1].transitionIn.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].transitionIn.kind": "dissolve",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 9,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  await inspector
    .getByRole("group", { name: "End edge" })
    .getByRole("button", { name: "Inspect transition" })
    .click();
  await expect(inspector.getByText("Owner: Harbor — Main, sequence frame 0")).toBeVisible();
  await inspector.getByLabel("Duration (sequence frames)").fill("10");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText("competes with another transition");
  await expect(inspector.getByText("8 sequence frames", { exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /Select dissolve/ })).toHaveCount(2);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a dissolve clipped at the start retains its phase and supplies black and silence", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionIn.id": "opening-dissolve",
    "sequence.tracks[0].placements[0].transitionIn.kind": "dissolve",
    "sequence.tracks[0].placements[0].transitionIn.durationFrames": 9,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Select dissolve: Harbor" }).click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByText("9 sequence frames", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Dissolve window: 0 inclusive – 5 exclusive")).toBeVisible();
  await expect(
    inspector.getByText("Blend starts 4 sequence frames into its authored phase."),
  ).toBeVisible();
  await expect(inspector.getByText("Outgoing picture: black")).toBeVisible();
  await expect(inspector.getByText("Outgoing audio: silence")).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
});

test("moving two dissolves into conflict retains both authored transitions", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionOut.id": "outgoing-dissolve",
    "sequence.tracks[0].placements[0].transitionOut.kind": "dissolve",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 12,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 130,
    "sequence.tracks[0].placements[1].transitionIn.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].transitionIn.kind": "dissolve",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 8,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  await page.keyboard.press("[");
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements)
    .toEqual([
      {
        id: "harbor-open",
        clipId: "harbor",
        sequenceStartFrame: 0,
        transitionOut: { id: "outgoing-dissolve", kind: "dissolve", durationFrames: 12 },
      },
      {
        id: "lighthouse-next",
        clipId: "lighthouse",
        sequenceStartFrame: 129,
        transitionIn: { id: "incoming-dissolve", kind: "dissolve", durationFrames: 8 },
      },
    ]);
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await expect(
    page.getByText("CutList unavailable: a dissolve competes with another transition."),
  ).toBeVisible();
});
