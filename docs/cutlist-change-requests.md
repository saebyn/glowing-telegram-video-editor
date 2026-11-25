# `CutList` specification change requests

Working list from the [sequence editor design](sequence-editor-design.md).
These are requirements to verify against the existing format and discuss
upstream where it falls short, not a proposed schema or a claim of renderer
support. `CutList` describes the flattened output, not the editable track
stack, placement ownership, or transition selection.

| Request | Behavior the format should describe |
| --- | --- |
| Audiovisual dissolve | Blend the outgoing and incoming sources over an explicit output-frame window centered on a cut. Describe the source range on each side, including transition-only footage beyond the ordinary trim, without shifting the cut, later source alignment, or overall output duration. Use the same window for a linear picture blend and linear audio crossfade. An odd window has one more frame after the cut; clipping at a sequence endpoint must preserve the blend phase. |
| Gaps and absent contributions | Preserve the frame count of intentional leading, internal, and trailing gaps with black and silence. Within a transition, describe absent picture or audio on one side separately from the other side and from a source load failure. |
| A visible cut inside a dissolve window | Future requirement to investigate: represent multiple source spans on a transition side without hiding an intervening visible cut or shifting later source ranges. The first editor version reports these arrangements as unsupported; whether or how to blend across that change is not settled. |

The current schema (`1.0.0`, published with
`@saebyn/glowing-telegram-types` `0.14.0`) provides ordered source
sections and edge-relative `transitionIn` / `transitionOut` durations.
There is no explicit two-source dissolve window or transition-only source
range. Before requesting a schema change for a particular case, verify
whether the existing encoding has defined semantics that preserve the
authored timing and contributions.

The preview's **No media** placeholder is not a request for a synthetic
render source. Final output should report expected media that fails to load.
