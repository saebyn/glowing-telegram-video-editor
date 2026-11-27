# Production bundle audit

From a checkout with Node.js 24 and dependencies installed with `npm ci`:

```sh
bash scripts/bundle-audit/run.sh "$PWD" "$(git rev-parse HEAD)"
```

Use any committed revision with the same lockfile as the installed checkout.
The runner uses Bash, Git, tar, and gzip. It builds archived snapshots in a
fresh directory under `${TMPDIR:-/tmp}`, leaving the checkout and installed
dependencies untouched. It prints the directory and keeps `environment.txt`,
build logs, tarballs, and `report.json` there for inspection. No server runs.

The runner compares the normal `npm run build` release with two benchmarks:

- **HLS light:** Alias `hls.js` to `hls.js/light` in Vite only. This retains the
  normal type check, not playback compatibility.
- **Compiler subpath:** Build `src/utils/compileCutList.ts` as a separate Vite
  ES library with the release minifier and no externals. Add the resulting
  files and a temporary `./compile-cut-list` export to the packed baseline.
  Verify the original release files and exports are unchanged. Compare the
  same compiler-only app using the baseline root import or the temporary
  subpath. Report the extra release JS separately from the app’s savings.
  This is a packaging benchmark, not a supported public entry point.

Fixtures import the unpacked npm tarballs, not source aliases. The source
review and sequence editor fixtures use `styles.css` and bundle their React
peers. A separate build checks `custom-only.css` and reports its relative-asset
resolution. A successful CSS build does not imply that all font URLs resolve.

The report counts raw bytes and `gzip -n -9` bytes per emitted file. Release JS
totals include all JS chunks; consumer initial JS includes the static import
graph, and the rest is deferred. CSS alternatives are reported separately.
Maps, declarations, and HTML are not included in the totals. Attribution is
an estimate based on generated spans in the production source maps; consumer
spans are traced through the packed bundle’s map where available. Gzip values
for isolated attribution buckets are not additive.
