import { expect, test } from "@playwright/test";
import {
  blockedOutput,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("Transition Properties resolves an authored odd dissolve and can resize it without changing the cut or trims", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].entryTransition.kind": "dissolve",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 7,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const indicator = timeline.getByRole("button", { name: "Select centered dissolve: Lighthouse" });
  await indicator.click();
  const before = (await lighthouse.boundingBox())!;
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(inspector.getByLabel("Leading dissolve duration (sequence frames)")).toHaveValue(
    "7",
  );
  await inspector.getByLabel("Leading dissolve duration (sequence frames)").fill("9");
  expect(await emissions()).toEqual(noEdits);
  await inspector.getByRole("button", { name: "Apply leading dissolve" }).click();
  await expect.poll(emissions).toEqual({
    sequences: [
      {
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
                entryTransition: {
                  id: "incoming-dissolve",
                  kind: "dissolve",
                  durationFrames: 9,
                },
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      {
        ok: false,
        issues: [{ code: "unsupported-dissolve", transitionId: "incoming-dissolve" }],
      },
    ],
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
    page.getByText("CutList unavailable: the format cannot represent a centered dissolve."),
  ).toBeVisible();
  expect(await lighthouse.boundingBox()).toMatchObject({ x: before.x, width: before.width });
});

test("adding a fade at a cut already owned by a dissolve explains the conflict without switching views", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].entryTransition.kind": "dissolve",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 9,
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
  await expect(timeline.getByRole("button", { name: /Select centered dissolve/ })).toHaveCount(1);
});

test("resizing a host-authored dissolve cannot commit while another dissolve owns the same cut", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].revealTransition.id": "outgoing-dissolve",
    "sequence.tracks[0].placements[0].revealTransition.kind": "dissolve",
    "sequence.tracks[0].placements[0].revealTransition.durationFrames": 8,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].entryTransition.kind": "dissolve",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 9,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  await inspector
    .getByRole("group", { name: "End edge" })
    .getByRole("button", { name: "Inspect transition" })
    .click();
  await expect(inspector.getByText("Owner: Harbor — Main, sequence frame 0")).toBeVisible();
  await inspector.getByLabel("Trailing dissolve duration (sequence frames)").fill("10");
  await inspector.getByRole("button", { name: "Apply trailing dissolve" }).click();
  await expect(inspector.getByRole("alert")).toContainText("competes with another transition");
  await expect(inspector.getByText("8 sequence frames", { exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /Select centered dissolve/ })).toHaveCount(2);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a dissolve clipped at the start retains its phase and supplies black and silence", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].placements[0].entryTransition.id": "opening-dissolve",
    "sequence.tracks[0].placements[0].entryTransition.kind": "dissolve",
    "sequence.tracks[0].placements[0].entryTransition.durationFrames": 9,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Select centered dissolve: Harbor" }).click();
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
    "sequence.durationFrames": 360,
    "sequence.tracks[0].placements[0].revealTransition.id": "outgoing-dissolve",
    "sequence.tracks[0].placements[0].revealTransition.kind": "dissolve",
    "sequence.tracks[0].placements[0].revealTransition.durationFrames": 12,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 130,
    "sequence.tracks[0].placements[1].entryTransition.id": "incoming-dissolve",
    "sequence.tracks[0].placements[1].entryTransition.kind": "dissolve",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 8,
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
        revealTransition: { id: "outgoing-dissolve", kind: "dissolve", durationFrames: 12 },
      },
      {
        id: "lighthouse-next",
        clipId: "lighthouse",
        sequenceStartFrame: 129,
        entryTransition: { id: "incoming-dissolve", kind: "dissolve", durationFrames: 8 },
      },
    ]);
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await expect(
    page.getByText("CutList unavailable: a centered dissolve competes with another transition."),
  ).toBeVisible();
});
