const tone = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Each colour reads its channels from a CSS variable (src/index.css) so a
        // seasonal theme can repaint the app by swapping variables. The
        // <alpha-value> form keeps opacity modifiers like bg-primary/20 working.
        primary: tone('primary'),
        'primary-light': tone('primary-light'),
        bg: tone('bg'),
        card: tone('card'),
        card2: tone('card2'),
        border: tone('border'),
        border2: tone('border2'),
        text: tone('text'),
        muted: tone('muted'),
        // Two greens and two reds were in use. Converged on the dominant green
        // (#10b981, 23 uses vs 4) and on the red that passes contrast — the
        // more common #ef4444 measures 3.89:1 on card, under AA for body text.
        green: tone('green'),
        red: tone('red'),
        'accent-text': tone('accent-text'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
}
