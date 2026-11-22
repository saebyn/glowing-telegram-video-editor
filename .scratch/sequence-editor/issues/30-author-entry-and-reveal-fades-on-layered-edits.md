# 30 — Author entry and reveal fades on layered edits

Status: ready-for-agent
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
