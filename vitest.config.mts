import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      'server-only': new URL('./src/lib/__mocks__/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
  },
})