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
  build: {
    // flag-icons ships ~270 SVGs, nearly all under Vite's 4 KiB inlining
    // threshold — left to the default they all land as data: URIs inside the
    // render-blocking stylesheet (~96 KB gzipped of flags nobody has asked to
    // see yet). Kept as files, the browser fetches only the handful actually
    // rendered, which is the whole reason this library was picked over a
    // bundled set of SVG components.
    assetsInlineLimit: (filePath: string) =>
      filePath.includes('flag-icons') ? false : undefined,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // @cockpit/shared is consumed as raw TS/JS source and has no build or
    // runner of its own, so its unit tests ride along here — the same Vitest
    // run CI already executes. The API exercises the same modules through
    // ts-jest in its own specs.
    include: [...configDefaults.include, '../../packages/shared/src/**/*.test.ts'],
    // e2e/ holds Playwright specs (run via `playwright test`, its own runner)
    // — Vitest's default exclude is just node_modules/.git, so without this
    // it tries to import and run them too.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
