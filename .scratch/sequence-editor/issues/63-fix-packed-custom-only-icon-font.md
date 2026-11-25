# 63 — Fix the icon font in packed `custom-only.css`

Status: ready-for-agent
Resolution: Both stylesheet exports reference one shipped Material Symbols font; verified in a clean npm tarball consumer in Chromium.

## Proposal

The [bundle audit](60-profile-dependency-bundle-costs.md) found that a
consumer can import `custom-only.css` from the npm tarball, but its relative
Material Symbols font URL does not resolve in the consumer build. This
breaks the [documented icon font support](../../../README.md#importing-styles)
for hosts that use their own Tailwind.

## Acceptance criteria

- Install the actual `npm pack` tarball in a clean consumer fixture. Import
  `@saebyn/glowing-telegram-video-editor/custom-only.css` without importing
  `styles.css`, and verify in Chromium that the Material Symbols Outlined
  font loads and an editor icon renders. Do not rely on the source checkout,
  a locally installed font, or a consumer-specific alias or copy step.
- Preserve both public stylesheet paths. Keep `custom-only.css` free of
  Tailwind base styles and utilities, and keep the custom timeline and
  seek styles available.
- Use the [bundle measurement rules](../TRIAGE.md#production-bundle-cleanup)
  to report both CSS outputs separately, including any changed font assets.

## Comments

- Prioritize this as a published-package regression. Start with the packed
  `custom-only.css` consumer from the [bundle audit](../../../scripts/bundle-audit/README.md).
  A successful consumer build alone is not enough; the browser must actually
  load the shipped font and render the icon.
- **Red:** Packed baseline `1462196` with `npm pack --ignore-scripts` and ran the
  new browser check against that tarball before changing the build. Vite could
  not resolve `../node_modules/material-symbols/material-symbols-outlined.woff2`.
  Chromium still showed the Export button, but drew `file_export` as 11
  Liberation Serif glyphs (`isCustomFont: false`); the test exited 1.
- **Green:** `npm run build` and
  `timeout --kill-after=5s 150s npm run test:packed-css` passed (exit 0).
  The fixture installs the actual tarball with `npm install`, imports only
  `custom-only.css`, and uses the source review page's **Clip Silences** action
  to expose the real Export icon. Chromium 158.0.8127.36 reported one glyph
  rendered with the custom Material Symbols Outlined font, with local font
  sources disabled. A separate smoke run using only `styles.css` also passed.
- **Mutation:** Removed only the shipped WOFF2 from a copy of the final build
  and repacked it. The clean consumer still built, but the same Chromium
  assertion failed again with 11 Liberation Serif glyphs (exit 1); restored
  the isolated build asset afterward. All browser checks used ephemeral
  loopback ports, not port 6007; confirmed shutdown with `ss`.
- **Release measurements:** Isolated baseline and final builds at `1462196`,
  changing only #63's package inputs. Node 24.22.3, npm 11.19.1, Vite 8.3.8,
  identical lockfile and installed dependencies, `NODE_ENV` unset. Counts are
  raw / `gzip -n -9` bytes; no maps or declarations.

  | Shipped output | Baseline | Fixed |
  | --- | ---: | ---: |
  | All JS chunks | 2,292,408 / 562,657 | 2,292,408 / 562,657 |
  | `styles.css` | 5,423,258 / 4,071,200 (font inline) | 55,795 / 11,091 |
  | `custom-only.css` | 19,066 / 3,932 (broken font URL) | 15,953 / 3,593 |
  | Shared WOFF2 | Not separately shipped | 4,025,760 / 4,023,785 |
  | `styles.css` + referenced font | 5,423,258 / 4,071,200 | 4,081,555 / 4,034,876 |
  | `custom-only.css` + referenced font | No usable font | 4,041,713 / 4,027,378 |

  Both CSS alternatives reference the same file, byte-identical to the
  baseline's embedded font. The tarball shrank from 6,534,438 to 6,493,106
  bytes. Both stylesheets retain the custom timeline and seek selectors;
  only `styles.css` has Tailwind base and utilities. Both JS chunks are
  byte-identical.
- `npm test -- --run` passed (215 unit and Storybook tests), along with
  typecheck, lint, formatting, script syntax, and `git diff --check`.
  Lint reported the existing `VideoPlayer.tsx` captions warning. Logs and
  measurements: `/tmp/opencode/sequence63.1J1voAD2/`.
