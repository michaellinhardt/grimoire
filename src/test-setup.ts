import '@testing-library/jest-dom/vitest'

// Mock ResizeObserver for jsdom (required by Radix UI ScrollArea)
class ResizeObserverMock {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}

global.ResizeObserver = ResizeObserverMock
