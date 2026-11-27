# Repository guidance

Glowing Telegram Video Editor is a React and TypeScript component library for video review and editing. [README.md](README.md) covers the public API; [the development guide](docs/development.md) is the reference for commands, Storybook, packaging (including the declaration layout), and releases.

- Keep public exports in [`src/index.ts`](src/index.ts) and shared types in [`src/types.ts`](src/types.ts). Update affected stories and check interactions in Storybook when changing components.
- Get explicit maintainer approval before changing the public interface, even before 1.0.
- Until 1.0, assume there are no downstream host apps. For approved interface changes, update this repository's callers and examples without adding compatibility layers for hypothetical hosts.
- Use [the glossary](GLOSSARY.md) for editing terminology. Keep positions as zero-based whole frames: source review and clip in/out points use the native source rate (in inclusive, out exclusive); sequence positions use the project rate supplied by `ProjectProvider`.
- Use [`src/utils/frames.ts`](src/utils/frames.ts) for conversions. In [`SourceTimeline`](src/components/organisms/SourceTimeline.tsx), keep positions in source frames and convert to or from seconds at the widget boundary.
- Sequence editor verification ends at editing behavior, host callbacks, and the emitted `CutList`. Downstream renderer behavior and rendered-media validation are outside this library's scope.
- Match checks to the change. For docs-only edits, check links, commands, and `git diff --check`; use the relevant development checks for code changes.

## Storybook server lifecycle

- Prefer one-shot checks: `npm test -- --run --project storybook` for story tests, or `npm run test:browser` to let Playwright start and stop its own Storybook on port `6007`.
- For a manual preview, check the port before starting. Reuse an existing server only if it serves the intended worktree; otherwise identify its owner rather than starting another copy on a different port or killing an unknown process.
- Give every agent-started preview a hard timeout, including HTTP servers for static Storybook builds. On Linux, for example: `timeout --kill-after=10s 15m npm run storybook -- --ci --host 127.0.0.1 --exact-port`. Record the port and how to stop the server; don't use `nohup` or `disown`.
- Stop the server and its child processes as soon as verification is done, even if it fails. Before handing off or ending the session, verify the port is no longer listening (for example, `ss -ltnp 'sport = :6006'`). Don't rely on closing OpenCode to clean up, and don't stop servers you didn't start without the user's permission.

## Agent skills

### Issue tracker

Issues and PRDs use local Markdown under `.scratch/`. See [issue tracker](docs/agents/issue-tracker.md).

### Triage labels

Triage uses the five default status values. See [triage labels](docs/agents/triage-labels.md).

### Domain docs

Single context; use the root `GLOSSARY.md`. See [domain docs](docs/agents/domain.md).
