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
| Run Vitest once | `npm test -- --run` |
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

[Unit-test CI](../.github/workflows/unittest.yml) runs `npm ci`, `npm run lint:ci`, `npm run format:check`, and `npm test` on pushes and pull requests to `main`. [Chromatic](../.github/workflows/chromatic.yml) checks Storybook on pushes. For UI changes, exercise the affected stories in the browser and check light and dark modes where applicable.

## Source layout

[`src/index.ts`](../src/index.ts) is the public entry point. [`src/components/`](../src/components) is organized into atoms, molecules, organisms, and pages; stories live alongside components. Shared types are in [`src/types.ts`](../src/types.ts), React providers in [`src/context/`](../src/context), and utility functions in [`src/utils/`](../src/utils). The local harness, [`src/app.tsx`](../src/app.tsx), renders `VideoSelectionPage` with [`src/data.json`](../src/data.json).

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
