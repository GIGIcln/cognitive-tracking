/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        granata: {
          DEFAULT: '#8B1A2E',
          dark: '#6B1020',
          light: '#A8223A',
        },
        oro: {
          DEFAULT: '#C9A227',
          light: '#E8BC30',
        },
      },
    },
  },
  plugins: [],
}