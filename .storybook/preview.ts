import type { Preview } from "@storybook/react";

// import the tailwindcss styles
import "tailwindcss/tailwind.css";
// import the material-symbols
import "material-symbols";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    darkMode: {
      // Set the initial theme
      current: 'light',
    },
  },

  tags: ["autodocs"]
};

export default preview;
