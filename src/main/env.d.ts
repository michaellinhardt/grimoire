/// <reference types="electron-vite/node" />

declare module '*.sql?raw' {
  const content: string
  export default content
}
