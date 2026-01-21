import { defineConfig } from 'vitest/config'

export default defineConfig({
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
