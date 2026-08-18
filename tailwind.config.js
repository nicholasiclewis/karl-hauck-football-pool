/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        'primary-light': '#60a5fa',
        bg: '#0f172a',
        card: '#1e293b',
        card2: '#253347',
        border: '#374e6b',
        border2: '#4a6585',
        text: '#f0f6ff',
        muted: '#94afd4',
        // Two greens and two reds were in use. Converged on the dominant green
        // (#10b981, 23 uses vs 4) and on the red that passes contrast — the
        // more common #ef4444 measures 3.89:1 on card, under AA for body text.
        green: '#10b981',
        red: '#f87171',
        'accent-text': '#93c5fd',
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
