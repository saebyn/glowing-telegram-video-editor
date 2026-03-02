import type { Preview } from "@storybook/react-vite";

// import the tailwindcss styles
import "tailwindcss/index.css";
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
  },

  tags: ["autodocs"]
};

export default preview;
