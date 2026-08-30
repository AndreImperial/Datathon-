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
        ink: "#edf7f4",
        cobalt: "#70c9d2",
        azure: "#9ae0e5",
        amber: {
          500: "#efad79",
          600: "#d88e5f",
          DEFAULT: "#efad79",
        },
        teal: "#84cbaa",
        canvas: "#0a171b",
        blue: {
          500: "#70c9d2",
          600: "#56b2bd",
          700: "#3c929e",
        },
        cyan: {
          500: "#9ae0e5",
          600: "#70c9d2",
        },
        emerald: {
          500: "#84cbaa",
          600: "#61ad8d",
        },
        slate: {
          500: "#78908e",
          600: "#94aaa7",
        },
        gray: {
          500: "#78908e",
          600: "#94aaa7",
        },
      },
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "sans-serif"],
        display: ["Newsreader Variable", "Newsreader", "serif"],
      },
      boxShadow: {
        lift: "0 18px 50px rgba(0,0,0,0.34)",
      },
    },
  },
  plugins: [],
};
