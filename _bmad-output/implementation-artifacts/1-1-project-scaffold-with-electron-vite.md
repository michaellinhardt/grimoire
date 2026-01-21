# Story 1.1: Project Scaffold with Electron-Vite

Status: in-progress

## Story

As a **developer**,
I want **a fully configured Electron project with the required tech stack**,
so that **I have a solid foundation to build Grimoire's features upon**.

## Acceptance Criteria

1. **Given** the developer runs the project initialization commands **When** the project is created with electron-vite react-ts template **Then** the project structure matches the Architecture specification
2. Tailwind CSS v4 is configured with dark-first color system (purple accent hsl 270, 60%, 55%)
3. Radix UI primitives are installed (@radix-ui/react-dialog, dropdown-menu, tooltip, scroll-area, tabs)
4. Zustand is configured for UI state management
5. SQLite (better-sqlite3) is set up with database at ~/.grimoire/grimoire.db
6. Zod is available for IPC validation
7. Vitest is configured with jsdom environment for renderer tests
8. The initial database schema is created (sessions, folders, file_edits, settings tables)
9. `npm run dev` launches the Electron app successfully
10. `npm run validate` (tsc + vitest + lint) passes

## Tasks / Subtasks

- [ ] Task 1: Initialize project with electron-vite react-ts template (AC: 1)
  - [ ] Run `npm create @quick-start/electron@latest grimoire -- --template react-ts`
  - [ ] Verify project structure exists with src/main, src/preload, src/renderer
  - [ ] Verify `npm run dev` launches Electron window

- [ ] Task 2: Install and configure Tailwind CSS v4 (AC: 2)
  - [ ] Run `npm install -D tailwindcss @tailwindcss/vite`
  - [ ] Configure vite plugin in electron.vite.config.ts
  - [ ] Create main CSS with Tailwind import and CSS variables for color system
  - [ ] Set up dark-first color tokens (see Dev Notes for exact values)
  - [ ] Verify Tailwind classes apply correctly in a test component

- [ ] Task 3: Install Radix UI primitives (AC: 3)
  - [ ] Run `npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-tabs`
  - [ ] Verify imports work in renderer process

- [ ] Task 4: Install and configure Zustand (AC: 4)
  - [ ] Run `npm install zustand`
  - [ ] Create initial store structure at `src/renderer/src/shared/store/useUIStore.ts`
  - [ ] Export placeholder UI state store following architecture pattern

- [ ] Task 5: Install and configure SQLite with better-sqlite3 (AC: 5, 8)
  - [ ] Run `npm install better-sqlite3`
  - [ ] Run `npm install -D @types/better-sqlite3`
  - [ ] Run `npx electron-rebuild -f -w better-sqlite3`
  - [ ] Create schema file at `src/shared/db/schema.sql`
  - [ ] Create database initialization module at `src/main/db.ts`
  - [ ] Implement version-aware schema recreation logic
  - [ ] Verify database creates at ~/.grimoire/grimoire.db on first run

- [ ] Task 6: Install Zod for validation (AC: 6)
  - [ ] Run `npm install zod`
  - [ ] Create shared types file at `src/shared/types/ipc.ts` with example schema

- [ ] Task 7: Configure Vitest testing (AC: 7, 10)
  - [ ] Run `npm install -D vitest @testing-library/react jsdom`
  - [ ] Create vitest.config.ts with jsdom environment for renderer tests
  - [ ] Add environment separation for main vs renderer tests
  - [ ] Create a sample test to verify setup works
  - [ ] Add `"validate"` script to package.json: `"tsc --noEmit && vitest run && npm run lint"`

- [ ] Task 8: Reorganize to feature-based structure (AC: 1)
  - [ ] Create directory structure per architecture document
  - [ ] Create src/renderer/src/core/shell/ placeholder
  - [ ] Create src/renderer/src/core/settings/ placeholder
  - [ ] Create src/renderer/src/core/loading/ placeholder
  - [ ] Create plugins/sessions/ directory structure
  - [ ] Create src/renderer/src/shared/hooks/ directory
  - [ ] Create src/renderer/src/shared/store/ directory
  - [ ] Create src/renderer/src/shared/utils/ directory

- [ ] Task 9: Final validation (AC: 9, 10)
  - [ ] Verify `npm run dev` launches the Electron app
  - [ ] Verify `npm run validate` passes (tsc + vitest + lint)
  - [ ] Verify database file is created at ~/.grimoire/grimoire.db

## Dev Notes

### Technology Stack Summary

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | Latest via electron-vite | Desktop app shell |
| electron-vite | react-ts template | Build tooling with HMR |
| React + TypeScript | Latest | UI framework |
| Tailwind CSS | v4.x (stable release 2025-01-22) | Utility-first CSS |
| Radix UI | Latest | Headless accessible primitives |
| Zustand | Latest | Runtime UI state management |
| better-sqlite3 | Latest | SQLite database |
| Zod | Latest | Runtime validation |
| Vitest | Latest | Testing framework |

### Critical Technical Details

#### Tailwind CSS v4 Configuration

Tailwind v4 is now stable (released 2025-01-22). Key v4 changes:
- CSS-first configuration (no tailwind.config.js required for basic setup)
- Uses `@import "tailwindcss"` in CSS instead of directives
- Lightning CSS engine for faster builds
- Automatic content detection

**CSS Variables for Dark-First Color System:**
```css
/* src/renderer/src/assets/main.css */
@import "tailwindcss";

:root {
  /* Background colors (dark theme primary) */
  --bg-base: hsl(240, 10%, 10%);
  --bg-elevated: hsl(240, 10%, 13%);
  --bg-hover: hsl(240, 10%, 16%);

  /* Text colors */
  --text-primary: hsl(0, 0%, 90%);
  --text-muted: hsl(0, 0%, 60%);

  /* Accent color - Purple */
  --accent: hsl(270, 60%, 55%);
  --accent-hover: hsl(270, 60%, 65%);
  --accent-active: hsl(270, 60%, 45%);
  --accent-muted: hsl(270, 30%, 25%);

  /* Semantic colors */
  --success: hsl(142, 50%, 45%);
  --warning: hsl(38, 90%, 50%);
  --error: hsl(0, 65%, 50%);
  --info: hsl(210, 60%, 50%);

  /* Borders */
  --border: hsl(240, 10%, 20%);

  /* Spacing base unit */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Typography */
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
}

body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-family);
}
```

#### electron-vite Vite Config for Tailwind

```typescript
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [
      react(),
      tailwindcss()
    ]
  }
})
```

#### better-sqlite3 with Electron

**CRITICAL:** better-sqlite3 is a native module and requires electron-rebuild.

```bash
# After npm install better-sqlite3
npx electron-rebuild -f -w better-sqlite3
```

If you encounter NODE_MODULE_VERSION mismatch errors:
1. Delete node_modules
2. Run `npm install`
3. Run `npx electron-rebuild -f -w better-sqlite3`

**Database Path:**
```typescript
// src/main/db.ts
import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'

const DB_VERSION = 1

export function initDatabase() {
  const grimoireDir = path.join(app.getPath('home'), '.grimoire')

  // Ensure directory exists
  if (!fs.existsSync(grimoireDir)) {
    fs.mkdirSync(grimoireDir, { recursive: true })
  }

  const dbPath = path.join(grimoireDir, 'grimoire.db')
  const db = new Database(dbPath)

  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion !== DB_VERSION) {
    console.warn(`Database schema changed (${currentVersion} → ${DB_VERSION}). Recreating database.`)
    // Read schema from file
    const schemaPath = path.join(__dirname, '../shared/db/schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    db.exec(schema)
    db.pragma(`user_version = ${DB_VERSION}`)
  }

  return db
}
```

#### Required Database Schema

```sql
-- src/shared/db/schema.sql
-- VERSION: 1
-- IMPORTANT: Bump version number when modifying this file

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  archived INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  forked_from_session_id TEXT,
  is_hidden INTEGER DEFAULT 0,
  FOREIGN KEY (forked_from_session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS session_metadata (
  session_id TEXT PRIMARY KEY,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  model TEXT,
  updated_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS folders (
  path TEXT PRIMARY KEY,
  is_pinned INTEGER DEFAULT 0,
  last_accessed_at INTEGER
);

CREATE TABLE IF NOT EXISTS file_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  tool_type TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_file_edits_file_path ON file_edits(file_path);
CREATE INDEX IF NOT EXISTS idx_file_edits_session_id ON file_edits(session_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
```

#### Zustand Store Pattern

```typescript
// src/renderer/src/shared/store/useUIStore.ts
import { create } from 'zustand'

interface UIState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  activeTab: string | null
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setActiveTab: (tabId: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: null,
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setActiveTab: (tabId) => set({ activeTab: tabId })
}))
```

#### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    environmentMatchGlobs: [
      ['src/main/**', 'node'],
      ['src/renderer/**', 'jsdom'],
      ['plugins/**/src/main/**', 'node'],
      ['plugins/**/src/renderer/**', 'jsdom']
    ]
  }
})
```

#### Package.json Scripts

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "lint": "eslint .",
    "validate": "tsc --noEmit && vitest run && npm run lint"
  }
}
```

### Project Structure Requirements

**Directory Structure to Create:**
```
grimoire/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   └── db.test.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── assets/
│   │       │   └── main.css
│   │       ├── core/
│   │       │   ├── shell/         (placeholder for Story 1.2)
│   │       │   ├── loading/       (placeholder for future)
│   │       │   └── settings/      (placeholder for future)
│   │       └── shared/
│   │           ├── hooks/
│   │           ├── store/
│   │           │   └── useUIStore.ts
│   │           └── utils/
│   └── shared/
│       ├── types/
│       │   └── ipc.ts
│       └── db/
│           └── schema.sql
├── plugins/
│   └── sessions/
│       └── src/
│           ├── main/
│           └── renderer/
├── electron.vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── package.json
```

### Architecture Compliance Checklist

- [ ] Use snake_case for database columns
- [ ] Use camelCase for TypeScript properties
- [ ] Store files follow pattern: `use{Name}Store.ts`
- [ ] Components use PascalCase: `ComponentName.tsx`
- [ ] Tests colocated: `ComponentName.test.ts`
- [ ] IPC channels use `namespace:action` pattern
- [ ] Zod schemas named `{Name}Schema`
- [ ] All state in Zustand stores (no React.useState for shared state)

### Testing Requirements

- Unit test for database initialization
- Verify schema creates all 4 tables
- Verify database file location is correct
- Verify validate script runs all checks

### References

- [Source: architecture.md#Technical Preferences Established] - Stack choices
- [Source: architecture.md#Data Architecture] - Database schema and location
- [Source: architecture.md#Implementation Patterns & Consistency Rules] - Naming conventions
- [Source: architecture.md#Complete Project Directory Structure] - File organization
- [Source: ux-design-specification.md#Design System Foundation] - Color system values
- [Source: prd.md#Technical Success] - Performance and reliability requirements
- [Source: epics.md#Story 1.1] - Acceptance criteria

### Web Research Summary (2026-01-22)

**Tailwind CSS v4:**
- Stable release as of 2025-01-22
- 5x faster full builds, 100x faster incremental builds
- CSS-first configuration, automatic content detection
- Uses `@import "tailwindcss"` syntax

**electron-vite:**
- electron-vite-react template actively maintained (last update Jan 2026)
- Supports native addons, debugger configuration included
- Use `npm create @quick-start/electron@latest grimoire -- --template react-ts`

**better-sqlite3 + Electron:**
- Always run `npx electron-rebuild -f -w better-sqlite3` after install
- NODE_MODULE_VERSION mismatch is common - delete node_modules and reinstall if encountered
- electron-builder with `install-app-deps` also works: `npx electron-builder install-app-deps`

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
