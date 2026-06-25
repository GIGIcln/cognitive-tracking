import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    clearMocks: true,
    env: {
      VITE_API_URL: '',
    },
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
  },
})
