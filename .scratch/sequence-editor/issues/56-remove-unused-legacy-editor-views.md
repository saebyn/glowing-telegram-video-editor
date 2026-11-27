# 56 — Remove unused legacy editor views

Resolution: Removed both legacy views and their private UI; retained the standalone audio controls and shared interfaces.

## Proposal

Remove `ProjectClipTimeline` and `VideoPreview` from the package. Neither is
used on `main` in `saebyn/glowing-telegram-frontend` or `saebyn/streamosaic`,
and neither is a dependency of `SequenceEditorPage`. The audit checked
Glowing Telegram Frontend at `614a6ab` and Streamosaic at `8ab5a51`, where
Streamosaic uses its own positioned timeline.

## Acceptance criteria

- Remove both root exports and their implementations, plus private modules,
  tests, stories, and documentation that serve only the removed views.
  Document the two removed exports as a breaking package change.
- Keep `AudioChannelNameEditor` and `WaveformDisplay` public and retain their
  stories and coverage, including the waveform test currently in
  `VideoPreview.test.tsx`. Keep `ProjectClipPool`, `ProjectClipPreview`,
  `VideoSelectionPage`, and the sequence editor intact. Don't remove public
  helpers or shared types just because a removed view used them.
- Report before/after production bundle bytes using the
  [shared measurement rules](../TRIAGE.md#production-bundle-cleanup).
- Run the relevant repository checks for the retained interfaces and behavior:
  typecheck, build, Vitest (including Storybook), and Playwright. Building or
  smoke-testing either downstream app is not required; old branches are out
  of scope.

## Comments

- Compared `npm run build` before/after on `2564982`, in the same archived
  checkout with Node `v24.22.3`, identical lockfile and settings, and a local
  copy of the installed dependencies. Counts use `wc -c` and
  `gzip -n -9 -c` and exclude maps, declarations, and Storybook output.

  | Output | Before raw / gzip | After raw / gzip | Gzip change |
  | --- | ---: | ---: | ---: |
  | JS | 1,346,016 / 346,939 | 1,323,682 / 341,325 | −5,614 |
  | `styles.css` | 5,425,750 / 4,071,584 | 5,422,927 / 4,071,251 | −333 |
  | `custom-only.css` | 19,124 / 3,944 | 19,066 / 3,932 | −12 |

  The stylesheets are alternatives. No referenced assets changed.
- Verified the built package root excludes both removed exports and still
  exposes `AudioChannelNameEditor`, `WaveformDisplay`, `ProjectClipPool`,
  `ProjectClipPreview`, `VideoSelectionPage`, `SequenceEditorPage`, and
  `layoutSequence`. `PreviewSettings` remains in the public declarations.
- Moved the `WaveformDisplay` test to the retained component. It caught a
  missing-canvas mutation; its story and the channel name editor story remain.
- Typecheck, build, format, lint (existing captions warning only), and all
  191 Vitest tests (unit and Storybook) passed. Playwright passed 151 of
  152 tests. The viewport-fitting drag check sometimes previews frame 122
  rather than 120; it also failed with the same output on the unchanged
  `2564982` baseline, so this ticket leaves it alone. Logs:
  `/tmp/opencode/sequence56-integrated.UWtBxC/` and
  `/tmp/opencode/sequence-layout-baseline.pXJuLS/`. The verification
  server was stopped.
- README documents the breaking change. The historical references to the
  legacy views in #49 and #52 do not establish a further integration scope.
