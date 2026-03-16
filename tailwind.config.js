/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#003087',
        'primary-light': '#4a7fd4',
        bg: '#00061a',
        card: '#000d2e',
        card2: '#001040',
        border: '#001a5c',
        border2: '#002480',
        text: '#d4e4ff',
        muted: '#3a6090',
        green: '#10b981',
        red: '#ef4444',
        'accent-text': '#a8c8ff',
      },
      fontFamily: {
        sans: ['Georgia', 'serif'],
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
}
