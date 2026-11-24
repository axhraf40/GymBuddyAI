import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F3F7F2",
        "bg-deep": "#E6EFE6",
        surface: "#FFFFFF",
        ink: "#0D1912",
        forest: "#1E6B3F",
        "forest-deep": "#0C3A22",
        "forest-pale": "#E3F0E6",
        lime: "#DAF85A",
        "lime-soft": "#F1FFC2",
        dark: "#08130D",
        "dark-2": "#10221A",
        secondary: "#3A4C40",
        tertiary: "#6B7D71",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(13,25,18,.04), 0 4px 16px rgba(13,25,18,.05)",
        card: "0 4px 12px rgba(13,25,18,.06), 0 24px 48px rgba(13,25,18,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
