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
        green: '#4ade80',
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
