import { expect, test, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("a loaded edit lists its gaps and can seek to the first without proposing an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { "sequence.durationFrames": 420 });
  const gaps = page.getByRole("region", { name: "CutList issues" });
  await expect(gaps).toContainText("Gaps are valid in a sequence");
  await expect(gaps).toContainText("120 inclusive – 240 exclusive");
  await expect(gaps).toContainText("360 inclusive – 420 exclusive");

  await gaps.getByRole("button", { name: "Jump to first gap" }).press("Enter");
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 120");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("a missing source can point to its placement even on a locked track", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    args: "sources.harbor-recording:!undefined;sequence.tracks[1].locked:true",
  });
  await page.goto(`/iframe.html?${query}`);
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing source metadata for harbor-recording", {
    timeout: 20_000,
  });
  await issues.getByRole("button", { name: "Inspect Harbor on Main" }).press("Space");
  await expect(
    page.getByText("This track is locked. Its placements can be inspected"),
  ).toBeVisible();
  await expect(page.getByText("Source in/out (source frames): 114 inclusive")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("an unresolved clip is explained without inferring a gap or offering inspection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[0].clipId": "unmapped",
  });
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing clip metadata for unmapped");
  await expect(issues.getByRole("button")).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
});

test("a source rate mismatch is identified separately and opens the hidden Inspector", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    args: "clips[0].sourceFrameRate.numerator:30;sequence.durationFrames:480;readOnly:true",
  });
  await page.goto(`/iframe.html?${query}`);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const inspectorToggle = editor.getByRole("button", { name: "Inspector", exact: true });
  await inspectorToggle.click({ timeout: 20_000 });
  const issues = editor.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText(
    "Source frame rate 30/1 does not match project frame rate 60/1",
  );
  await issues.getByRole("button", { name: "Inspect Harbor on Main" }).press("Enter");
  await expect(inspectorToggle).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByText("Source in/out (source frames): 114 inclusive")).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
});

test("correcting source metadata in the host clears its issue without an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/?path=/story/${layeredEditStoryId}&args=sources.harbor-recording:!undefined`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const issues = story.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing source metadata for harbor-recording", {
    timeout: 20_000,
  });

  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.getByRole("switch", { name: "Edit sources as JSON" }).click();
  const sources = page.getByRole("textbox", { name: "Edit sources as JSON" });
  await sources.fill(
    JSON.stringify({
      "harbor-recording": {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        previewHlsUrl: "/fixtures/harbor.m3u8",
      },
      "lighthouse-recording": {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        previewHlsUrl: "/fixtures/lighthouse.m3u8",
      },
    }),
  );
  await sources.blur();

  await expect(issues).toHaveCount(0);
  await expect(story.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

async function recordManagedStoryEmissions(page: Page) {
  // The workflow emits callbacks inside the preview iframe, not the Controls window.
  await page.addInitScript(() => {
    if (window === window.parent) return;
    for (const type of ["sequence-editor:sequence-change", "sequence-editor:cut-list-result"]) {
      window.addEventListener(type, (event) => {
        window.parent.dispatchEvent(
          new CustomEvent(type, { detail: (event as CustomEvent).detail }),
        );
      });
    }
  });
  return recordEditorEmissions(page);
}

async function replaceHarborRate(page: Page, numerator: number) {
  const json = page.getByRole("textbox", { name: "Edit clips as JSON" });
  if (!(await json.isVisible())) {
    await page.getByRole("tab", { name: /Controls/ }).click();
    await page.getByRole("switch", { name: "Edit clips as JSON" }).click();
  }
  const clips = JSON.parse(await json.inputValue());
  clips[0].sourceFrameRate.numerator = numerator;
  await json.fill(JSON.stringify(clips));
  await json.blur();
}

for (const readOnly of [false, true]) {
  test(`a zero source rate can be corrected live in the ${readOnly ? "read-only" : "editable"} editor`, async ({
    page,
  }) => {
    const emissions = await recordManagedStoryEmissions(page);
    const query = new URLSearchParams({
      path: `/story/${layeredEditStoryId}`,
      args: `clips[0].sourceFrameRate.numerator:0${readOnly ? ";readOnly:true" : ""}`,
    });
    await page.goto(`/?${query}`);
    const story = page.frameLocator("#storybook-preview-iframe");
    const issues = story.getByRole("region", { name: "CutList issues" });
    const timeline = story.getByRole("region", { name: "Sequence timeline" });
    const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
    await expect(issues).toContainText("Placement harbor-bed has an invalid source frame rate.", {
      timeout: 20_000,
    });
    await expect(harbor).toHaveCount(0);
    await expect(timeline.getByRole("button", { name: "Lighthouse", exact: true })).toHaveCount(2);

    await replaceHarborRate(page, 60);
    await expect(harbor).toBeVisible();
    await expect(issues).toHaveCount(0);
    await expect(story.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    expect(await emissions()).toEqual(noEdits);
  });

  test(`a fractional source rate leaves other placements usable in the ${readOnly ? "read-only" : "editable"} editor`, async ({
    page,
  }) => {
    const emissions = await recordManagedStoryEmissions(page);
    await page.goto(`/?path=/story/${layeredEditStoryId}${readOnly ? "&args=readOnly:true" : ""}`);
    const story = page.frameLocator("#storybook-preview-iframe");
    const issues = story.getByRole("region", { name: "CutList issues" });
    const timeline = story.getByRole("region", { name: "Sequence timeline" });
    const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
    const inspector = story.getByRole("region", { name: "Inspector", exact: true });
    const sourceOut = inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" });
    await harbor.click({ timeout: 20_000 });
    const harborRange = inspector.getByText(
      "Sequence start/end (sequence frames): 0 inclusive – 240 exclusive",
    );
    await expect(harborRange).toBeVisible();
    if (readOnly) await expect(sourceOut).toHaveCount(0);
    else await expect(sourceOut).toBeVisible();

    // Use JSON Controls because dots in URL args can be sanitized.
    await replaceHarborRate(page, 29.97);
    await expect(issues).toContainText("Placement harbor-bed has an invalid source frame rate.");
    await expect(harbor).toHaveCount(0);
    await expect(harborRange).toHaveCount(0);
    await expect(sourceOut).toHaveCount(0);
    expect(await emissions()).toEqual(noEdits);

    await timeline.getByRole("button", { name: "Lighthouse", exact: true }).first().click();
    await expect(
      inspector.getByText("Sequence start/end (sequence frames): 0 inclusive – 60 exclusive"),
    ).toBeVisible();
    if (!readOnly) {
      await sourceOut.fill("571");
      await inspector.getByRole("button", { name: "Trim placement", exact: true }).click();
      await expect(
        inspector.getByText("Sequence start/end (sequence frames): 0 inclusive – 70 exclusive"),
      ).toBeVisible();
    }
    const beforeCorrection = await emissions();
    if (readOnly) {
      expect(beforeCorrection).toEqual(noEdits);
    } else {
      expect(beforeCorrection).toEqual({
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
                    sourceOutOffsetFrames: -50,
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
            ],
          },
        ],
        cutListResults: [
          {
            ok: false,
            issues: [
              {
                code: "invalid-source-frame-rate",
                placementId: "harbor-bed",
                sourceFrameRate: { numerator: 29.97, denominator: 1 },
              },
            ],
          },
        ],
      });
    }

    await replaceHarborRate(page, 60);
    await expect(harbor).toBeVisible();
    await expect(issues).toHaveCount(0);
    expect(await emissions()).toEqual(beforeCorrection);
  });
}
