/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // GitHub-like color palette
        'gh-bg': '#ffffff',
        'gh-bg-secondary': '#f6f8fa',
        'gh-bg-tertiary': '#eaeef2',
        'gh-border': '#d0d7de',
        'gh-border-muted': '#d8dee4',
        'gh-text': '#1f2328',
        'gh-text-secondary': '#656d76',
        'gh-text-muted': '#8c959f',
        'gh-link': '#0969da',
        'gh-accent': '#0969da',
        'gh-accent-emphasis': '#0550ae',
        'gh-success': '#1a7f37',
        'gh-success-subtle': '#dafbe1',
        'gh-warning': '#9a6700',
        'gh-warning-subtle': '#fff8c5',
        'gh-danger': '#cf222e',
        'gh-danger-subtle': '#ffebe9',
        'gh-done': '#8250df',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['12px', '20px'],
        'sm': ['14px', '20px'],
        'base': ['14px', '21px'],
        'lg': ['16px', '24px'],
        'xl': ['20px', '28px'],
        '2xl': ['24px', '32px'],
      },
      borderRadius: {
        'gh': '6px',
        'gh-lg': '12px',
      },
      boxShadow: {
        'gh': '0 1px 0 rgba(31, 35, 40, 0.04)',
        'gh-md': '0 3px 6px rgba(140, 149, 159, 0.15)',
        'gh-lg': '0 8px 24px rgba(140, 149, 159, 0.2)',
        'gh-inset': 'inset 0 1px 0 rgba(208, 215, 222, 0.2)',
      },
      spacing: {
        '4.5': '18px',
      },
    },
  },
  plugins: [],
};
