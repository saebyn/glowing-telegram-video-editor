# Development

Use Node.js 24 to match CI:

```sh
git clone https://github.com/saebyn/glowing-telegram-video-editor.git
cd glowing-telegram-video-editor
npm ci
```

| Task | Command |
| --- | --- |
| Type-check | `npm run typecheck` |
| Run unit and Storybook tests once | `npm test -- --run` |
| Run unit tests without Chromium | `npm test -- --run --project unit` |
| Run only the Storybook Vitest project | `npm test -- --run --project storybook` |
| Run browser tests against Storybook | `npm run test:browser` |
| Open the Vitest UI (uses the URL printed on startup) | `npm run test:ui` |
| Lint with Oxlint | `npm run lint` |
| Apply Oxlint fixes | `npm run lint:fix` |
| Lint with GitHub Actions annotations | `npm run lint:ci` |
| Format source with Oxfmt | `npm run format` |
| Check source formatting | `npm run format:check` |
| Build the library | `npm run build` |
| Rebuild the Vite library on changes | `npm run dev` |
| Start Storybook at [localhost:6006](http://localhost:6006) | `npm run storybook` |
| Build static Storybook | `npm run build-storybook` |

[Test CI](../.github/workflows/unittest.yml) installs dependencies and Chromium,
then runs lint, formatting, and Vitest on pushes and pull requests to `main`.
[Chromatic](../.github/workflows/chromatic.yml) checks Storybook on pushes.
For UI changes, exercise the affected stories in the browser and check light
and dark modes where applicable.

Both the Storybook Vitest project and the separate Playwright suite require
Chromium. Install it with `npx playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible local Chromium
executable (for example on NixOS). The Playwright suite starts its own
Storybook on port 6007. The `SequenceEditorPage` workflow stories use local
fixtures and make no media service requests.

Prefer Storybook args and Controls for fixture state and Actions for callback payloads.
Use story `play` functions for interactions they can exercise faithfully; keep real
browser-pointer tests for native gestures such as dragging a clip from the pool.

### Manual sequence Preview checks

Open **Pages / SequenceEditorPreview** in Storybook. **Local Dissolve** uses a
local MPEG-TS fixture with alternating tones and incremental brightness. Play
through the dissolve, seek and single-step around frame 15, then play in
reverse. Reverse should be silent; seeking and stepping to the same frame
should show the same picture. The uncovered tail should be black and silent,
including at the sequence endpoint. Try accepting a split or placement move
while Preview is active. Check in both light and dark mode.

With the browser's network throttling enabled, play while Preview is loading.
Verify the playhead holds, then resumes. Repeat, but pause, seek, hide Preview,
or change the rendition before the request finishes. Old requests should not
restore old picture, sound, or play intent. **Missing Expected Sound** should
diagnose missing sound when playing forward without confusing it with a gap.
**Molecules / SequencePreview / Public HLS Smoke** exercises the component
directly with three placements from the public Mux sample. Scrub the
read-only timeline to compare the opening fade (0–1s), dissolve (3–5s),
hard cut (8s), and closing fade (11–12s). In **Controls → Media**, you can replace
the sequence, clips, or `sources.<sourceId>.previewHlsUrl` (keep the trim and
duration within the new source). A finite MPEG-TS playlist and its segments
must be accessible from the Storybook origin. The Mux story is a
network-dependent smoke check, not a timing assertion.

## Source layout

[`src/index.ts`](../src/index.ts) is the public entry point. [`src/components/`](../src/components) is organized into atoms, molecules, organisms, and pages; stories live alongside components. Shared types are in [`src/types.ts`](../src/types.ts), React providers in [`src/context/`](../src/context), and utility functions in [`src/utils/`](../src/utils). The local harness, [`src/app.tsx`](../src/app.tsx), renders `VideoSelectionPage` with [`src/data.json`](../src/data.json).

Atoms are individual controls or leaf widgets, such as a button or playhead
grip. Molecules group controls for one task, such as editing a frame value or
controlling playback. Organisms compose those pieces into larger editor sections,
such as the toolbar, inspector, or timeline.

## Library build and package

[`package.json`](../package.json) defines the package exports for `@saebyn/glowing-telegram-video-editor`. `npm run build` produces:

- `dist/glowing-telegram-video-editor.js`: the ES module, with React and React DOM as external peer dependencies.
- `dist/index.d.ts` and supporting declaration files.
- `dist/glowing-telegram-video-editor.css` (`styles.css`) and `dist/custom-only.css` (`custom-only.css`), the full and custom-only stylesheets.

Keep `dts({ outDir: "dist" })` in [`vite.config.ts`](../vite.config.ts) and `compilerOptions.rootDir: "./src"` in [`tsconfig.json`](../tsconfig.json). The plugin uses `rootDir` to put `index.d.ts` at the root of `dist/`; without it, declarations can land under `dist/src/` and miss the types export. Leave declaration bundling off (`bundleTypes`, called `rollupTypes` in older versions): API Extractor has failed to resolve `@/` aliases here and emitted `export {}`.

To inspect what npm would ship, run `npm run build` followed by `npm pack --dry-run`.

## Releases

Publishing a GitHub release triggers the [npm publish workflow](../.github/workflows/publish.yml). Pushing a tag or saving a draft release does not trigger it. The workflow installs dependencies, builds the library, and runs `npm publish`.

For a release, land the version bump (including the lockfile) on `main`. Substitute the version and that commit's SHA below, then tag the commit, push the tag, and publish the GitHub release:

```sh
git tag vX.Y.Z RELEASE_COMMIT_SHA
git push origin vX.Y.Z
gh release create vX.Y.Z --verify-tag --generate-notes
```
