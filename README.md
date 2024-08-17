![reactjs-vite-tailwindcss-boilerplate](https://user-images.githubusercontent.com/16243531/217138979-b854309c-4742-4275-a705-f9fec5158217.jpg)

# Video Editor Dashboard

## Overview

The Video Editor Dashboard is a web-based Single Page Application (SPA) designed for streamers to review and edit video highlights, attentions, and transcription errors. The primary users of this application are streamers familiar with video editing tools like DaVinci Resolve and have a programming background. This application aims to provide an intuitive interface for vetting and correcting data to feed into an automated pipeline that posts edited stream VODs to YouTube.

## Goals

- Efficient Data Management: Enable users to review, edit, and manage video highlights, attentions, and transcription errors efficiently.
- Context Verification: Provide synchronized video/audio playback to allow users to verify and adjust markers for highlights accurately.
- Integrated Workflow: Seamlessly integrate the UI into a larger tool without the need for import/export or additional integrations.
- Responsive Design: Ensure usability on various screen sizes, with a primary focus on desktop use.

## Key Features

- Main Dashboard:
  - Header: Contains the application logo, navigation menu (Home, Highlights, Attentions, Transcription Errors), and a user profile section with logout functionality.
  - Sidebar: Quick links to different sections (Highlights, Attentions, Transcription Errors) and a search bar for easy navigation.
  - Content Area: Displays summary statistics (total highlights, attentions, transcription errors) and a button to add new entries.
- Highlights Section:
  - List View: A table displaying highlights with columns for Start Time, End Time, Description, Reasoning, and Actions (Edit, Delete).
  - Detail/Edit View: A form for detailed editing with timestamp pickers and text areas for description and reasoning, including Save, Cancel, and Delete buttons.
- Integrated Timeline and Video Playback:
  - Timeline: Display highlights, attentions, and transcription errors on a single, integrated timeline with color-coded markers and zoom/pan functionality.
  - Video Player: Synchronized video/audio playback with controls (play, pause, seek, speed control) and a current timestamp indicator.
- Attentions Section:
  - List View: Similar to the Highlights section, with columns for Start Time, End Time, Description, Reasoning, and Actions (Edit, Delete).
  - Detail/Edit View: A form for editing attention details.
- Transcription Errors Section:
  - List View: A table with columns for Timestamp, Category, Description, and Actions (Edit, Delete).
  - Detail/Edit View: A form for editing transcription error details, including a dropdown for category selection and text area for description.

## Design Decisions

    User-Centric Design: Tailored for streamers who are technically inclined and familiar with video editing tools.
    Integrated Workflow: Focused on providing a seamless experience by integrating the UI directly into a larger tool without import/export needs.
    Contextual Verification: Emphasis on video/audio playback for accurate context verification while editing highlights.
    Responsive Layout: Designed primarily for desktop use but adaptable to various screen sizes to utilize available real estate effectively.
    Consistent and Intuitive UI: Maintains a consistent layout across different sections with clear labels and annotations, ensuring a cohesive user experience.

## What is inside?

This project uses many tools like:

- [Vite](https://vitejs.dev)
- [ReactJS](https://reactjs.org)
- [TypeScript](https://www.typescriptlang.org)
- [Vitest](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [Tailwindcss](https://tailwindcss.com)
- [Eslint](https://eslint.org)
- [Prettier](https://prettier.io)

## Getting Started

### Install

Access the project directory.

```bash
cd my-app
```

Install dependencies.

```bash
npm install
```

Serve with hot reload at <http://localhost:5173>.

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Typecheck

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

### Test

```bash
npm run test
```

View and interact with your tests via UI.

```bash
npm run test:ui
```

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.
