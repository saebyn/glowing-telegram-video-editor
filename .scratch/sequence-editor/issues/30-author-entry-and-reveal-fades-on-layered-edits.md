# 30 — Author entry and reveal fades on layered edits

Resolution: implemented and verified at the `CutList` and host callback boundaries
Depends on: [37](37-represent-entry-and-reveal-fades-as-transition-objects.md)

[27](27-flatten-multitrack-sequences-with-transitions.md) compiles some
multitrack fades, but [28](28-keep-empty-tracks-neutral-for-fades.md) left
authoring controls unavailable whenever more than one track is occupied.

## Proposed acceptance criteria

- Use the Inspector and timeline handles to create or adjust a supported
  entry or reveal fade with more than one occupied track. Occupied-track count
  alone must not disable either control.
- In the layered workflow, author a reveal on upper placement B over lower
  placement A. The result is A → B with the authored `transitionOut` → A,
  with A resuming at the source frame corresponding to B's exclusive
  sequence end. Verify one edit and the matching `CutList`.
- Explain when a visible fade cannot be represented instead of silently
  shortening it. A fully covered fade stays authored and selectable and
  does not prevent export on its own. A gap elsewhere must not prevent
  adjusting a locally valid fade.
- Keep existing entry/reveal timing. Cut-spanning dissolves and downstream
  rendered-media verification are separate.

## Comments

- This closes the authoring gap left by [27](27-flatten-multitrack-sequences-with-transitions.md);
  it does not reopen the compiler ticket.
- Red → green: the Inspector had no fade controls on the layered story.
  A 12-frame reveal now emits one exact callback pair and Harbor resumes at
  source frame 174, aligned with the end of the upper Lighthouse. The
  timeline edits a valid local fade even if a gap elsewhere prevents a
  `CutList`; an interrupted visible fade commits with a specific explanation.
- Static Storybook: 34 fade and Split checks passed in light and dark.
  Stryker killed 33/49 authoring and feedback mutants (16 survived, no
  timeouts). Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket30-layered-fade/reports/mutation/mutation.json`.
