import { expect, test } from "@playwright/test";
import {
  compiled,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("one Apply converts type and duration together, without replacing the transition or moving the cut", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].sourceOutOffsetFrames": -96,
    "sequence.tracks[0].placements[0].transitionOut.id": "harbor-transition",
    "sequence.tracks[0].placements[0].transitionOut.kind": "dissolve",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 40,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 24,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const dissolve = timeline.getByRole("button", { name: "Select dissolve: Harbor" });
  const fade = timeline.getByRole("button", { name: "Select reveal fade: Harbor" });
  const type = inspector.getByRole("combobox", { name: "Type", exact: true });
  const duration = inspector.getByRole("spinbutton", { name: "Duration (sequence frames)" });
  const apply = inspector.getByRole("button", { name: "Apply", exact: true });
  await dissolve.click();
  await expect(type).toHaveValue("dissolve");
  await expect(duration).toHaveValue("40");
  await expect(inspector.getByText("Dissolve window: 4 inclusive – 44 exclusive")).toBeVisible();
  await type.selectOption({ label: "Fade" });
  await expect(duration).toHaveValue("40");
  expect(await emissions()).toEqual(noEdits);
  await apply.click();
  await expect(inspector.getByRole("alert")).toContainText("between 1 and 24 sequence frames");
  await expect(dissolve).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("40 sequence frames", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);

  await duration.fill("24");
  await apply.click();
  const faded = {
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
            transitionOut: { id: "harbor-transition", kind: "fade", durationFrames: 24 },
          },
          { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 24 },
        ],
      },
    ],
  };
  const fadeOutput = compiled({
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
  });
  await expect.poll(emissions).toStrictEqual({ sequences: [faded], cutListResults: [fadeOutput] });
  await expect(fade).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Dissolve window:")).toHaveCount(0);
  await expect(inspector.getByText("Edge: End", { exact: true })).toBeVisible();

  await type.selectOption({ label: "Dissolve" });
  await duration.fill("15");
  await apply.click();
  const dissolved = structuredClone(faded);
  dissolved.tracks[0].placements[0].transitionOut = {
    id: "harbor-transition",
    kind: "dissolve",
    durationFrames: 15,
  };
  await expect.poll(emissions).toStrictEqual({
    sequences: [faded, dissolved],
    cutListResults: [
      fadeOutput,
      { ok: false, issues: [{ code: "unsupported-dissolve", transitionId: "harbor-transition" }] },
    ],
  });
  await expect(dissolve).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByText("Dissolve window: 17 inclusive – 32 exclusive")).toBeVisible();
});

test("Remove selects only the owner; Undo restores the same transition", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  const reveal = { id: "harbor-reveal", kind: "dissolve", durationFrames: 20 };
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].transitionIn.id": "harbor-entry",
    "sequence.tracks[0].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[0].transitionIn.durationFrames": 16,
    "sequence.tracks[0].placements[0].transitionOut.id": reveal.id,
    "sequence.tracks[0].placements[0].transitionOut.kind": reveal.kind,
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": reveal.durationFrames,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const dissolve = timeline.getByRole("button", { name: "Select dissolve: Harbor" });
  const remove = inspector.getByRole("button", { name: "Remove transition" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const duration = inspector.getByRole("spinbutton", { name: "Duration (sequence frames)" });
  await dissolve.click();
  await duration.fill("0");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText("positive whole number");
  await expect(dissolve).toHaveAttribute("aria-pressed", "true");
  expect(await emissions()).toStrictEqual(noEdits);

  await remove.click({ timeout: 5_000 });
  await expect(inspector.getByRole("heading", { name: "Placement Properties" })).toBeVisible();
  const end = inspector.getByRole("group", { name: "End edge" });
  await expect(end.getByRole("button", { name: "Add transition" })).toBeEnabled();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect(dissolve).toHaveCount(0);
  const removed = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-open",
            clipId: "harbor",
            sequenceStartFrame: 0,
            transitionIn: { id: "harbor-entry", kind: "fade", durationFrames: 16 },
          },
          { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
        ],
      },
    ],
  };
  const output = compiled({
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
      { mediaIndex: 0, sectionIndex: 0, transitionIn: { type: "fade", duration: 16 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  });
  await expect.poll(emissions).toStrictEqual({
    sequences: [removed],
    cutListResults: [output],
  });
  await undo.click();
  await expect(undo).toBeDisabled();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(dissolve).toHaveAttribute("aria-pressed", "false");
  await expect(end.getByRole("button", { name: "Inspect transition" })).toBeEnabled();
  const restored = structuredClone(removed);
  Object.assign(restored.tracks[0].placements[0], { transitionOut: reveal });
  await expect.poll(emissions).toStrictEqual({
    sequences: [removed, restored],
    cutListResults: [
      output,
      { ok: false, issues: [{ code: "unsupported-dissolve", transitionId: reveal.id }] },
    ],
  });
});
