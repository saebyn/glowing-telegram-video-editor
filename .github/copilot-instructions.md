# Glowing Telegram Video Editor

Glowing Telegram Video Editor is a React TypeScript component library for reviewing and editing video highlights, moments requiring attention, and transcription errors. It provides synchronized video/audio playback while reviewing AI-generated information. The library is built as an ES module for integration into the larger glowing-telegram tool.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build Repository
- Install dependencies: `npm ci` -- takes 48 seconds. NEVER CANCEL. Set timeout to 90-120 seconds.
- Run typecheck: `npm run typecheck` -- takes 3 seconds
- Build the library: `npm run build` -- takes 10 seconds. NEVER CANCEL. Set timeout to 30-60 seconds.
- Run tests: `npm run test` -- takes 3 seconds (18 tests pass). NEVER CANCEL. Set timeout to 10-15 seconds.

### Development Workflow Commands
- **Lint code**: `npm run lint` -- takes 0.2 seconds. Note: Currently has 1 accessibility warning in Timeline.tsx which is expected.
- **Format code**: `npm run format` -- takes 0.2 seconds
- **Lint for CI**: `npm run biome:ci` -- takes 0.2 seconds (outputs GitHub Actions format)
- **Watch build**: `npm run dev` -- rebuilds library on file changes
- **Interactive test UI**: `npm run test:ui` -- opens Vitest UI at http://localhost:51204/__vitest__/

### Storybook Development
- **Run Storybook**: `npm run storybook` -- starts development server at http://localhost:6006 in ~4 seconds
- **Build Storybook**: `npm run build-storybook` -- takes 23 seconds. NEVER CANCEL. Set timeout to 60+ minutes.

## Validation

### Manual Testing Requirements
After making changes, ALWAYS run through this complete validation workflow:
1. **Install and build**: `npm ci && npm run build`
2. **Run all tests**: `npm run test`
3. **Check linting**: `npm run biome:ci`
4. **Verify Storybook components**: `npm run storybook` -- then manually check affected components in browser
5. **Validate build artifacts**: Check that `dist/glowing-telegram-video-editor.js` and `dist/glowing-telegram-video-editor.css` are generated correctly

### Required Pre-commit Validation
Before committing changes, ALWAYS run these commands or CI will fail:
- `npm run biome:ci` -- must pass (1 accessibility warning is acceptable)
- `npm run test` -- all 18 tests must pass
- `npm run build` -- must complete successfully

### Story Validation
When changing React components:
- ALWAYS validate changes in Storybook at `http://localhost:6006`
- Test the affected component stories manually in the browser
- Verify component props and interactions work as expected
- Check both light and dark modes if the component supports it

## Project Structure and Key Areas

### Primary Development Areas
- **Components**: `src/components/` organized by atomic design (atoms, molecules, organisms, pages)
- **Types**: `src/types.ts` contains shared TypeScript interfaces
- **Utils**: `src/utils/` contains tested utility functions for timeline and duration handling
- **Context**: `src/context/` for React context providers
- **Entry point**: `src/index.ts` exports the main VideoSelectionPage component

### Key Files to Monitor
- **Entry point**: `src/index.ts` -- exports library interface
- **Main component**: `src/components/pages/VideoSelectionPage.tsx` -- primary application page
- **Timeline**: `src/components/organisms/Timeline.tsx` -- complex timeline visualization (has known accessibility warning)
- **Video player**: `src/components/molecules/VideoPlayer.tsx` -- HLS video playback component

### Configuration Files
- **Vite config**: `vite.config.ts` -- build configuration for library mode
- **TypeScript**: `tsconfig.json` -- compiler options with path mapping
- **Biome**: `biome.json` -- linting and formatting rules
- **Test setup**: `.vitest/setup.ts` -- test environment configuration

## Build System Details

### Library Build Process
- **Input**: TypeScript React components from `src/`
- **Output**: ES module at `dist/glowing-telegram-video-editor.js` with CSS at `dist/glowing-telegram-video-editor.css`
- **External dependencies**: React and React-DOM are marked as peer dependencies
- **Declaration files**: TypeScript .d.ts files generated in `dist/`

### Testing Framework
- **Test runner**: Vitest with happy-dom environment
- **Test files**: Located alongside source in `src/utils/*.test.ts`
- **Coverage**: Available via `npm run test` output
- **Interactive mode**: `npm run test:ui` for debugging tests

### Known Build Warnings
- TypeScript warning about VideoPlayer.stories.tsx private name export -- this is expected and safe to ignore
- One accessibility warning in Timeline.tsx about keyboard events -- this is tracked and acceptable
- Large Storybook chunks warning -- this is expected for the static build

## Common Development Tasks

### Adding New Components
1. Create component in appropriate `src/components/` subdirectory
2. Export component types in `src/types.ts` if shared
3. Add corresponding `.stories.tsx` file for Storybook
4. Export component in `src/index.ts` if it's part of the public API
5. Run `npm run build && npm run storybook` to validate

### Updating Existing Components
1. Modify component files in `src/components/`
2. Update corresponding stories if component API changed
3. Run `npm run test` to ensure no regressions
4. Run `npm run storybook` and manually test changes
5. Run `npm run build` to ensure library builds correctly

### Working with Video/Timeline Features
- **Video handling**: Components use HLS.js for video playback
- **Timeline data**: Check `src/data.json` for example data structure
- **Duration utilities**: Use functions from `src/utils/duration.ts` for time calculations
- **Timeline utilities**: Use functions from `src/utils/timeline.ts` for timeline operations

## Timing Expectations

### Command Timing (add 50% buffer for timeouts)
- `npm ci`: 48 seconds → use 120 second timeout
- `npm run build`: 10 seconds → use 30 minute timeout
- `npm run test`: 3 seconds → use 30 minute timeout
- `npm run build-storybook`: 23 seconds → use 60 minute timeout
- `npm run typecheck`: 3 seconds → use 30 second timeout
- `npm run lint`: 0.2 seconds → use 30 second timeout
- `npm run format`: 0.2 seconds → use 30 second timeout

### **CRITICAL BUILD WARNINGS**
- **NEVER CANCEL** any build or test command even if it appears to hang
- All builds complete in under 1 minute except npm ci (48 seconds)
- If a command appears stuck, wait at least 2 minutes before investigating
- Builds are fast but should be given generous timeouts to account for system load

## Repository Information

### Package Details
- **Name**: @saebyn/glowing-telegram-video-editor
- **Type**: ES module React component library
- **License**: AGPL-3.0-only
- **Main export**: VideoSelectionPage component and types

### CI/CD Pipeline
- **Unit tests**: GitHub Actions runs `npm ci`, `npm run biome:ci`, `npm test`
- **Chromatic**: Visual regression testing for Storybook components
- **Publishing**: Automated npm publishing on GitHub releases

### Dependencies
- **React**: 19.x (peer dependency)
- **Build tools**: Vite, TypeScript, Biome
- **Testing**: Vitest, Testing Library, happy-dom
- **Styling**: TailwindCSS 4.x, Material Symbols icons
- **Video**: HLS.js for video playback