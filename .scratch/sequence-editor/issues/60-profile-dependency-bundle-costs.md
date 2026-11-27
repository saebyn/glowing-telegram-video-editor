# 60 — Profile runtime dependency and entry costs

Resolution: Measured the released and consumer bundles; recommend a separate compiler entry and retaining full HLS.js.

## Proposal

Attribute the production JavaScript bundle to library code and major
dependencies, starting with HLS.js, the Keplar timeline widget, and the Temporal
polyfill. Compare the full release bundle and small local production-build
fixtures that import source review, sequence editing, and `compileCutList`
without UI. Measure what the existing entry already lets consumers tree-shake
before proposing a change.

## Acceptance criteria

- Report the largest contributors and rank concrete candidates by measured
  bytes saved and risk. Consider narrower dependency entry points or a smaller
  implementation behind an existing seam only after measuring what survives
  bundling. Don't replace the media or timeline adapter as part of this audit.
- Keep the package-root and CSS imports working. Use the
  [shared bundle measurement rules](../TRIAGE.md#production-bundle-cleanup).
  If a candidate loads code later, report initial and total bytes separately;
  deferring a chunk is not a reduction in total size. Don't count moving a
  dependency to host installation as savings.
- End with a reproducible baseline and a recommendation (or an explanation
  that no candidate justifies the compatibility cost). File implementation
  work separately if warranted. No downstream app builds are required.

## Comments

- Reproduce with `bash scripts/bundle-audit/run.sh "$PWD" cba0f84`. Node
  `v24.22.3`, Vite `8.3.8`, same lockfile and installed dependencies across
  variants. Each consumer imports actual packed exports from a small
  production fixture. Counts are raw / `gzip -n -9` bytes; all fixture JS
  was initial, with zero deferred JS. UI fixtures include React and React DOM.

  | Production JS | Release baseline | HLS light benchmark | Compiler subpath benchmark |
  | --- | ---: | ---: | ---: |
  | All release chunks | 1,323,682 / 341,325 | 1,052,015 / 270,869 | 1,332,775 / 344,376 |
  | Source review, package root | 1,134,572 / 338,823 | 918,219 / 274,872 | Not measured |
  | Sequence editor, package root | 1,195,521 / 356,965 | 979,156 / 293,080 | Not measured |
  | Compiler only, no UI or CSS | 903,851 / 268,618 | 687,539 / 204,654 | 7,476 / 2,900 |

  Both CSS alternatives are unchanged: `styles.css` 5,421,977 raw /
  4,071,065 gzip and `custom-only.css` 19,066 raw / 3,932 gzip. All import
  paths resolve, and the compiler-subpath benchmark preserves every original
  release file byte-for-byte. The packed custom-only stylesheet's existing
  relative Material Symbols URL does not resolve in the fixture. The full
  stylesheet embeds the same 4,025,760-byte WOFF2 (4,023,785 gzip bytes on
  its own). Font packaging is not changed by this audit.
- Generated spans in the release source map estimate **657,881 raw bytes**
  for HLS.js, **313,912** for Keplar (each including vendored dependencies),
  **125,993** for editor code, **67,811** for Temporal, and **158,085**
  unmapped/generated. The compiler-only root fixture still contains about
  577,857 HLS.js, 249,289 Keplar, and 56,063 Temporal raw bytes despite using
  none for compilation. Attribution is approximate; isolated gzip buckets
  in the report are not additive.
- **1. Isolate compiler imports** ([follow-up #61](61-isolate-the-compiler-package-entry.md)).
  The benchmark saves **265,718 gzip bytes (98.9%)** in the compiler-only
  fixture, adding **3,051 gzip bytes** to the release for a second artifact.
  Measure duplication in a consumer importing both entries before choosing
  a release layout. No dependency was externalized and no bytes deferred.
- **2. Keep full HLS.js.** The light entry saves **70,456 gzip bytes** from
  the release, but drops alternate audio, subtitles, DRM, and other playback
  features the host HLS URL contract does not exclude. This is a size
  benchmark, not runtime parity. Keplar exposes no narrower ESM entry;
  Temporal's duration-only entry was not benchmarked without proving
  compatible parsing/rounding. No adapter or package interface changed.
- Bash/Node syntax, script lint/format, links, and the full audit runner
  passed. Changing the benchmark fixture to import the root instead of
  the packed subpath failed the explicit import guard. Reports:
  `/tmp/opencode/video-editor-bundle-audit.jKPnmVtm/report.json` and
  `/tmp/opencode/sequence60-mutation.M88xmC/mutation.log`.
