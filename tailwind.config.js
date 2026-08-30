/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "fill-blue-500", "stroke-blue-500",
    "fill-cyan-500", "stroke-cyan-500",
    "fill-emerald-500", "stroke-emerald-500",
    "fill-slate-500", "stroke-slate-500",
    "fill-amber-500", "stroke-amber-500",
    "fill-gray-500", "stroke-gray-500",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17343b",
        cobalt: "#206a78",
        azure: "#4c8e9b",
        amber: {
          500: "#a45a35",
          600: "#8f4d2e",
          DEFAULT: "#a45a35",
        },
        teal: "#4d7a6c",
        canvas: "#f2f5f3",
        blue: {
          500: "#206a78",
          600: "#1b5b67",
          700: "#164b55",
        },
        cyan: {
          500: "#4c8e9b",
          600: "#3b7783",
        },
        emerald: {
          500: "#4d7a6c",
          600: "#3f685b",
        },
        slate: {
          500: "#718286",
          600: "#647477",
        },
        gray: {
          500: "#879496",
          600: "#6f7f82",
        },
      },
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "sans-serif"],
        display: ["Newsreader Variable", "Newsreader", "serif"],
      },
      boxShadow: {
        lift: "0 18px 50px rgba(18,35,63,0.10)",
      },
    },
  },
  plugins: [],
};
