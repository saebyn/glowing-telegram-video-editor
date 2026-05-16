# Agent Notes

## Publishing

- Releases are published to npm via GitHub Actions CI, triggered by pushing a version tag.
- After bumping the version and committing, always:
  1. Push the commit
  2. Push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
  3. Create a GitHub release: `gh release create vX.Y.Z --generate-notes`

## Type Declaration Generation (vite-plugin-dts)

- `vite-plugin-dts` is used to emit `.d.ts` files during `vite build`.
- `package.json` exports `"types": "./dist/index.d.ts"` — so `dist/index.d.ts` must exist at the root of `dist/`.
- Without configuration, the plugin mirrors the source tree into `dist/src/`, which does **not** match the exports path.
- **Fix**: set `rootDir: "./src"` in `tsconfig.json`. The plugin reads `compilerOptions.rootDir` to determine `publicRoot`, which controls where declarations are rooted in the output dir.
- **Do not use `rollupTypes: true`**: API Extractor (used internally) cannot resolve `@/` path aliases and produces `export {}`.
- Correct plugin config: `dts({ outDir: 'dist' })` — combined with `rootDir` in tsconfig, this produces `dist/index.d.ts` with all exports intact.
