import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // e2e/ holds Playwright specs (run via `playwright test`, its own runner)
    // — Vitest's default exclude is just node_modules/.git, so without this
    // it tries to import and run them too.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
