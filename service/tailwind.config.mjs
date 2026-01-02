/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // GitHub-like color palette using CSS variables for theming
        "gh-bg": "var(--gh-bg)",
        "gh-bg-secondary": "var(--gh-bg-secondary)",
        "gh-bg-tertiary": "var(--gh-bg-tertiary)",
        "gh-border": "var(--gh-border)",
        "gh-border-muted": "var(--gh-border-muted)",
        "gh-text": "var(--gh-text)",
        "gh-text-secondary": "var(--gh-text-secondary)",
        "gh-text-muted": "var(--gh-text-muted)",
        "gh-link": "var(--gh-link)",
        "gh-accent": "var(--gh-accent)",
        "gh-accent-emphasis": "var(--gh-accent-emphasis)",
        "gh-success": "var(--gh-success)",
        "gh-success-subtle": "var(--gh-success-subtle)",
        "gh-warning": "var(--gh-warning)",
        "gh-warning-subtle": "var(--gh-warning-subtle)",
        "gh-danger": "var(--gh-danger)",
        "gh-danger-subtle": "var(--gh-danger-subtle)",
        "gh-done": "var(--gh-done)",
        "gh-tooltip": "var(--gh-tooltip)",
        "gh-tooltip-text": "var(--gh-tooltip-text)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      fontSize: {
        xs: ["12px", "20px"],
        sm: ["14px", "20px"],
        base: ["14px", "21px"],
        lg: ["16px", "24px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
      },
      borderRadius: {
        gh: "6px",
        "gh-lg": "12px",
      },
      boxShadow: {
        gh: "0 1px 0 rgba(31, 35, 40, 0.04)",
        "gh-md": "0 3px 6px rgba(140, 149, 159, 0.15)",
        "gh-lg": "0 8px 24px rgba(140, 149, 159, 0.2)",
        "gh-inset": "inset 0 1px 0 rgba(208, 215, 222, 0.2)",
      },
      spacing: {
        4.5: "18px",
      },
      animation: {
        'ghost-pulse': 'ghost-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'ghost-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
