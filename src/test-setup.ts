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

// Mock IntersectionObserver for jsdom (required by useActiveTimelineEvent hook)
class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly thresholds: readonly number[] = []

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

global.IntersectionObserver = IntersectionObserverMock
