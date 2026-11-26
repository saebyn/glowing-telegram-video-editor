import { expect, test, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function recordInputErrors(page: Page) {
  await page.addInitScript(() => {
    const errors: unknown[] = [];
    Object.assign(window, { sequenceEditorInputErrors: errors });
    window.addEventListener("sequence-editor:input-error", (event) => {
      errors.push((event as CustomEvent).detail);
    });
  });
  return () =>
    page.evaluate(
      () =>
        (window as Window & { sequenceEditorInputErrors?: unknown[] }).sequenceEditorInputErrors,
    );
}

test("a loaded edit lists its gaps and can seek to the first without proposing an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const inputErrors = await recordInputErrors(page);
  await openWorkflow(page, roughCutStoryId, { "sequence.durationFrames": 420 });
  const gaps = page.getByRole("region", { name: "CutList issues" });
  await expect(gaps).toContainText("Gaps are valid in a sequence");
  await expect(gaps).toContainText("120 inclusive – 240 exclusive");
  await expect(gaps).toContainText("360 inclusive – 420 exclusive");

  await gaps.getByRole("button", { name: "Jump to first gap" }).press("Enter");
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 120");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
  expect(await inputErrors()).toEqual([]);
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
  const inputErrors = await recordInputErrors(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[0].clipId": "unmapped",
  });
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing clip metadata for unmapped");
  await expect(issues.getByRole("button")).toHaveCount(0);
  await expect
    .poll(inputErrors)
    .toEqual([[{ code: "missing-clip", placementId: "harbor-open", clipId: "unmapped" }]]);
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
    for (const type of [
      "sequence-editor:sequence-change",
      "sequence-editor:cut-list-result",
      "sequence-editor:input-error",
    ]) {
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
    await expect(timeline).toContainText("Timeline unavailable");

    await replaceHarborRate(page, 60);
    await expect(harbor).toBeVisible();
    await expect(issues).toHaveCount(0);
    await expect(story.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    expect(await emissions()).toEqual(noEdits);
  });

  test(`a fractional source rate blocks the ${readOnly ? "read-only" : "editable"} session until recovery`, async ({
    page,
  }) => {
    const emissions = await recordManagedStoryEmissions(page);
    const inputErrors = await recordInputErrors(page);
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
    const fractional = {
      code: "invalid-source-frame-rate",
      placementId: "harbor-bed",
      sourceFrameRate: { numerator: 29.97, denominator: 1 },
    };
    await expect.poll(inputErrors).toEqual([[fractional]]);

    await expect(timeline).toContainText("Timeline unavailable");
    await expect(sourceOut).toHaveCount(0);
    await expect(story.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
    await story.getByRole("region", { name: "Sequence editor", exact: true }).press("Control+d");
    expect(await emissions()).toEqual(noEdits);
    expect(await inputErrors()).toEqual([[fractional]]);

    await replaceHarborRate(page, 60);
    await expect(harbor).toBeVisible();
    await expect(issues).toHaveCount(0);
    expect(await emissions()).toEqual(noEdits);
    if (!readOnly) {
      await timeline.getByRole("button", { name: "Lighthouse", exact: true }).first().click();
      await sourceOut.fill("571");
      await inspector.getByRole("button", { name: "Trim placement", exact: true }).click();
      await expect(
        inspector.getByText("Sequence start/end (sequence frames): 0 inclusive – 70 exclusive"),
      ).toBeVisible();
      const result = await emissions();
      expect(result.sequences).toHaveLength(1);
      expect(result.cutListResults).toEqual([expect.objectContaining({ ok: true })]);
    }
  });
}

test("a host-built layout stops playback and rejects retained actions until inputs recover", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const inputErrors = await recordInputErrors(page);
  await page.goto(
    "/iframe.html?id=examples-sequence-editor-composition--replace-invalid-inputs&viewMode=story",
  );
  await page.getByRole("button", { name: "Retain slot actions" }).click({ timeout: 20_000 });
  const replace = page.getByRole("button", { name: "Replace host inputs" });
  const preview = page.getByText(/of 240 ·/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(preview).toContainText("forward");
  await replace.click();
  const invalidRate = page.getByText("The project frame rate must be a positive ratio");
  await expect(invalidRate).toBeVisible();
  await expect(preview).toContainText("paused");
  const frame = await page.getByLabel("Preview sequence frame").innerText();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Invoke retained edit and transport" }).click();
  await expect(preview).toContainText("paused");
  await expect(page.getByLabel("Preview sequence frame")).toHaveText(frame);
  expect(await emissions()).toEqual(noEdits);

  const fractional = {
    code: "invalid-project-frame-rate",
    frameRate: { numerator: 29.97, denominator: 1 },
  };
  const zero = { ...fractional, frameRate: { numerator: 0, denominator: 1 } };
  await expect.poll(inputErrors).toEqual([[fractional]]);
  await replace.click(); // Equivalent diagnostic with new inputs and reversed rate key order.
  await expect(page.getByText("Host input replacement 2")).toBeVisible();
  expect(await inputErrors()).toEqual([[fractional]]);
  await replace.click();
  await expect.poll(inputErrors).toEqual([[fractional], [zero]]);
  await replace.click();
  await expect(invalidRate).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(preview).toContainText("forward");
  await replace.click();
  await expect.poll(inputErrors).toEqual([[fractional], [zero], [fractional]]);
  await expect(preview).toContainText("paused");
});
