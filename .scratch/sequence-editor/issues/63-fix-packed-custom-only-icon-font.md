# 63 — Fix the icon font in packed `custom-only.css`

Status: needs-triage

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
