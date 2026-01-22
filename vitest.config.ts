import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'plugins/**/*.test.ts',
      'plugins/**/*.test.tsx'
    ],
    environment: 'jsdom',
    globals: true,
    environmentMatchGlobs: [
      ['src/main/**/*.test.ts', 'node'],
      ['src/preload/**/*.test.ts', 'node'],
      ['plugins/**/src/main/**/*.test.ts', 'node']
    ]
  }
})
