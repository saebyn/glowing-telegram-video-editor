# Repository guidance

Glowing Telegram Video Editor is a React and TypeScript component library for video review and editing. [README.md](README.md) covers the public API; [the development guide](docs/development.md) is the reference for commands, Storybook, packaging (including the declaration layout), and releases.

- Keep public exports in [`src/index.ts`](src/index.ts) and shared types in [`src/types.ts`](src/types.ts). Update affected stories and check interactions in Storybook when changing components.
- Use [the glossary](GLOSSARY.md) for editing terminology. Keep positions as zero-based whole frames: source review and clip in/out points use the native source rate (in inclusive, out exclusive); sequence positions use the project rate supplied by `ProjectProvider`.
- Use [`src/utils/frames.ts`](src/utils/frames.ts) for conversions. In [`SourceTimeline`](src/components/organisms/SourceTimeline.tsx), keep positions in source frames and convert to or from seconds at the widget boundary.
- Match checks to the change. For docs-only edits, check links, commands, and `git diff --check`; use the relevant development checks for code changes.
