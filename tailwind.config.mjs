import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{mjs,js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        body: ["Nunito"],
      },

      animation: {
        "highlight-new": "highlight-new 1s ease-in-out",
      },
      keyframes: {
        "highlight-new": {
          "0%, 100%": { backgroundColor: "transparent" },
          "25%": { backgroundColor: "rgba(255, 255, 0, 0.8)" },
        },
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
  ],
};
