/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        granata: {
          50:  '#fdf2f4',
          100: '#fbe8ec',
          200: '#f5d0d8',
          300: '#edaab8',
          400: '#e07a92',
          500: '#cf4f6c',
          600: '#b83054',
          700: '#8B1A2E',
          800: '#7a1828',
          900: '#681525',
          950: '#3b0912',
          DEFAULT: '#8B1A2E',
        },
        oro: {
          50:  '#fdfaee',
          100: '#faf3d0',
          200: '#f4e49d',
          300: '#ecce61',
          400: '#e3b530',
          500: '#C9A227',
          600: '#b07e19',
          700: '#8d5f16',
          800: '#754b19',
          900: '#643e19',
          950: '#39200a',
          DEFAULT: '#C9A227',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
