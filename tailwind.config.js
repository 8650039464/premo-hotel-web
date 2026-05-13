/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables set in app/layout.tsx (root layout reads
        // the `premo-brand` cookie set by edge middleware and injects vars).
        // Default fallbacks defined in app/globals.css (:root selector).
        //
        // Variables are stored as space-separated RGB triplets (e.g. "253 197 7")
        // so Tailwind opacity modifiers like `bg-primary/20` work — Tailwind
        // emits `rgb(var(--primary) / <alpha-value>)` and substitutes the alpha.
        primary:        'rgb(var(--primary) / <alpha-value>)',
        'primary-dark': 'rgb(var(--primary-dark) / <alpha-value>)',
        'primary-light':'rgb(var(--primary-light) / <alpha-value>)',
        accent:         'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
