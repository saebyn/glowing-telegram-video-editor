# 59 — Limit Tailwind scanning to shipped UI

Resolution: Restricted the library's Tailwind scan to production source directories.

## Proposal

[`index.css`](../../../src/index.css) imports Tailwind with automatic source
detection. Measure whether that pulls utilities used only by stories, tests,
fixtures, or the local app into the published stylesheet. Compare the current
scan to explicit production sources. Keep Storybook styling available without
making the library ship story-only utilities.

## Acceptance criteria

- Preserve the `styles.css` and `custom-only.css` export paths and what each
  provides. Verify utilities for every retained public view and standalone
  control, including variant classes, dark mode, focus states, and classes
  referenced indirectly. Don't remove the custom timeline styles or icon font
  as an incidental change.
- Check representative views in a local fixture using the built stylesheet;
  extra CSS in Storybook must not mask missing shipped styles.
- Measure both CSS exports with the
  [shared bundle measurement rules](../TRIAGE.md#production-bundle-cleanup).
  Report the delta separately for each. Keep the narrower scan only if it
  reduces shipped bytes without changing supported rendering.

## Comments

- Compared `npm run build` before and after in the same `f6db199` source snapshot,
  with Node `v24.22.3`, the same lockfile and settings. Counts use `wc -c`
  and `gzip -n -9 -c`; CSS exports are alternatives.

  | Output | Before raw / gzip | After raw / gzip | Gzip change |
  | --- | ---: | ---: | ---: |
  | `styles.css` | 5,422,927 / 4,071,251 | 5,421,977 / 4,071,065 | −186 |
  | `custom-only.css` | 19,066 / 3,932 | 19,066 / 3,932 | 0 |
  | JS | 1,323,682 / 341,325 | 1,323,682 / 341,325 | 0 |

- Audited the generated rule diff: the removed rules came from development
  sources or incidental tokens. Production class literals (including
  indirect variants), custom timeline/seek rules, CSS exports, and the
  4,025,760-byte Material Symbols WOFF2 were preserved.
- The agreed Chromium fixture imported the built package and only its full
  stylesheet, with no Storybook CSS. Light/dark layout, hover, disabled, and
  keyboard-focus computed styles matched for representative sequence editor,
  source review, and standalone controls. The story-only `h-[70vh]` check
  failed on the broad scan and passed on the explicit scan; excluding
  `ProjectClipPreview.tsx` killed the missing-production-scan mutant.
  Static Storybook still emitted that story-only utility. Unit, typecheck,
  format, and lint checks also passed on the isolated legacy-removal
  candidate (existing captions warning only).
- Fixture and red/mutation logs: `/tmp/opencode/sequence-editor-59.PraOjh/`.
  Integrated package and selector checks: `/tmp/opencode/sequence59-combined.z4dwNj/`.
  Fixture listeners were closed.
