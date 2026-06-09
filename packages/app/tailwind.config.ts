import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gaffer: {
          black: "#0B0E14",
          surface: "#131A24",
          "surface-2": "#1B2430",
          pitch: "#15392B",
          "pitch-light": "#1F5240",
          gold: "#D4AF37",
          "gold-light": "#F5E192",
          electric: "#22C58D",
          "electric-dim": "#15936A",
          red: "#E25563",
          muted: "#8B97A6",
          "muted-2": "#4A5663",
          base: "#0052FF",
        },
        rarity: {
          bronze: "#CD7F32",
          silver: "#C0C0C0",
          gold: "#D4AF37",
          icon: "#22C58D",
        },
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      transitionTimingFunction: {
        "ease-out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
        "ease-in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      backgroundImage: {
        "pitch-gradient":
          "linear-gradient(180deg, #0B0E14 0%, #0F2A20 50%, #0B0E14 100%)",
        "card-bronze":
          "linear-gradient(145deg, #3D2000 0%, #CD7F32 50%, #3D2000 100%)",
        "card-silver":
          "linear-gradient(145deg, #1A1A1A 0%, #C0C0C0 50%, #1A1A1A 100%)",
        "card-gold":
          "linear-gradient(145deg, #2A1F00 0%, #D4AF37 50%, #2A1F00 100%)",
        "card-icon":
          "linear-gradient(145deg, #06241A 0%, #22C58D 50%, #06241A 100%)",
        "hero-overlay":
          "linear-gradient(180deg, rgba(11,14,20,0.3) 0%, rgba(11,14,20,0.7) 60%, #0B0E14 100%)",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "score-tick": "score-tick 0.4s ease-out",
        "card-flip": "card-flip 0.6s ease-in-out",
        "slide-up": "slide-up 0.4s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,255,135,0.4)" },
          "50%": { boxShadow: "0 0 50px rgba(0,255,135,0.9)" },
        },
        "score-tick": {
          "0%": { transform: "scale(1.4)", color: "#00FF87" },
          "100%": { transform: "scale(1)" },
        },
        "card-flip": {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        "card-bronze": "0 0 20px rgba(205,127,50,0.35)",
        "card-silver": "0 0 20px rgba(192,192,192,0.35)",
        "card-gold": "0 0 20px rgba(212,175,55,0.4)",
        "card-icon": "0 0 28px rgba(34,197,141,0.45)",
        "glow-electric": "0 0 22px rgba(34,197,141,0.32)",
        "glow-gold": "0 0 22px rgba(212,175,55,0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
