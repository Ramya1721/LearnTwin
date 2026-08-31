/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0A0D13",
          900: "#0F131B",
          800: "#151A24",
          700: "#1D2330",
          600: "#28303F",
          500: "#3A4356",
        },
        mist: {
          400: "#6B7488",
          300: "#8B93A7",
          200: "#B4BACB",
          100: "#DDE1EA",
          50: "#F2F4F8",
        },
        signal: {
          DEFAULT: "#2FE6D0",
          dim: "#1FA694",
          soft: "rgba(47,230,208,0.12)",
        },
        twin: {
          DEFAULT: "#7C8CFF",
          dim: "#5A64C4",
          soft: "rgba(124,140,255,0.12)",
        },
        alert: {
          DEFAULT: "#F2A93B",
          soft: "rgba(242,169,59,0.12)",
        },
        danger: {
          DEFAULT: "#F2586B",
          soft: "rgba(242,88,107,0.12)",
        },
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
