# Future features

- [ ] Implement filtering search in sidebar
- [ ] Make zooming on the timeline pan towards the mouse cursor
- [ ] Add storybook setup for components and reorg components into folders according to the atomic design principles
- [ ] Use https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#adding_subtitles_and_other_timed_text_tracks to add subtitles to the video instead of the `VideoCaption` component
- [ ] Create edit overlay when editing any of the annotations, drawing from the left side of the screen
- [ ] Add a "close in" to fine-tune the time range of an annotation in the editor
- [ ] Can select group of highlights to combine into an episode
- [ ] Can edit transcript in side panel: https://github.com/lovasoa/react-contenteditable
  - [ ] make sure the editable area is sufficiently large and expands as needed
  - [ ] make sure the editable area is scrollable
  - [ ] show blank lines with a timestamp when no timestamp is present, so that I can add transcripts for missing parts
- [ ] Add slot for actions on whole form, can we extract child components and have more slots. context to avoid prop drilling?
