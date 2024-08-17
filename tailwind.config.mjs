/** @type {import('tailwindcss').Config} */

export default {
  content: ["./src/**/*.{mjs,js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        body: ["Nunito"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
