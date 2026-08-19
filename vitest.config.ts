import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest 4 removed the `workspace` option and vitest.workspace.js in favour of `projects`.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './shared',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        resolve: {
          alias: {
            '@r4u/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
          },
        },
        test: {
          name: 'server',
          root: './server',
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.ts'],
          // the first run downloads a mongod binary
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': fileURLToPath(new URL('./client/src', import.meta.url)),
            '@r4u/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
          },
        },
        test: {
          name: 'client',
          root: './client',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
