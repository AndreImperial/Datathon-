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
        ink: "#f7f4f4",
        cobalt: "#e12636",
        azure: "#ff7b84",
        amber: {
          500: "#c4616a",
          600: "#a24750",
          DEFAULT: "#c4616a",
        },
        teal: "#f2eeee",
        canvas: "#070708",
        blue: {
          500: "#e12636",
          600: "#c1121f",
          700: "#a90f1b",
        },
        cyan: {
          500: "#ff7b84",
          600: "#e12636",
        },
        emerald: {
          500: "#f2eeee",
          600: "#d7cfd0",
        },
        slate: {
          500: "#91888a",
          600: "#746b6d",
        },
        gray: {
          500: "#6f6769",
          600: "#554e50",
        },
      },
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "sans-serif"],
        display: ["Manrope Variable", "Manrope", "sans-serif"],
      },
      boxShadow: {
        lift: "0 20px 50px rgba(0,0,0,0.42)",
      },
    },
  },
  plugins: [],
};
