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
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12233f",
        cobalt: "#1e40af",
        azure: "#3b82f6",
        amber: "#d97706",
        teal: "#0f766e",
        canvas: "#f4f6fa",
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
