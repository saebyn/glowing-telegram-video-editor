# 90 — Show dissolve details independently of export eligibility

Status: ready-for-agent
Resolution: Inspect the dissolve window and resolvable source extensions independently of CutList export eligibility.
Review priority: P2
Related: [32 — Show cut-spanning dissolves and source extensions](32-show-cut-spanning-dissolves-and-source-extensions.md)

## Problem

[`getSequenceDissolves`](../../../src/utils/sequenceTransitions.ts) drops
all dissolve details if compilation finds any source or rate issue. Add an
unrelated 60 fps placement after a 30 fps dissolve and the unchanged
dissolve's window and source extensions disappear from the Inspector, even
though Preview can still resolve it.

## Acceptance criteria

- A valid dissolve retains its sequence window and resolvable source
  extensions when an unrelated placement has a source/project rate mismatch
  or missing render metadata. Export issues still appear separately.
- Base inspection on placement and source information, not the compiler's
  issue list. If a particular contribution cannot be resolved, do not
  fabricate its source range or suppress unrelated details.
- Verify the Inspector on initial load and after a host changes an unrelated
  clip. No edit callback is needed to update the details.

## Comments

- Three Chromium Storybook regressions cover missing render metadata at load,
  an unrelated live rate change, and a mixed-rate contributor whose extension
  does not have whole native-frame boundaries. Resolvable details remain visible
  alongside the separate export issues; host updates emit no edit callbacks.
- Verified 10 focused Storybook tests, 55 unit tests, typecheck, lint,
  formatting, and `git diff --check`. All four targeted mutations were caught.
