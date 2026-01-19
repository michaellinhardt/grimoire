---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-grimoire-2026-01-09.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'architecture'
project_name: 'grimoire'
user_name: 'Teazyou'
date: '2026-01-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

67 functional requirements organized into 8 categories:
- **Application Shell (FR1-7):** Multi-panel Obsidian-inspired layout with ribbon navigation, collapsible panels, resizable dividers, and tab system for multiple open sessions
- **Application Lifecycle (FR8-19):** Loading screen with CC verification, HOME/auth checks, offline support, auto-updates, state persistence
- **Plugin System (FR20-24):** Enable/disable plugins, per-plugin settings, core plugins use same architecture as future community plugins
- **Session Management (FR25-32):** Session list from isolated HOME's .claude folder, metadata display, archive functionality, active child process indicators
- **Conversation Display (FR33-42):** Message bubbles, tool call cards, sub-agent expansion, error indicators, navigation map, streaming indicators
- **Session Information (FR43-46):** Token usage display, per-message consumption, full metadata exposure
- **Session Interaction (FR47-60):** Chat input, real-time streaming, child process spawn/stop with configurable idle timeout, session UUID generation, abort capability
- **CC Integration (FR61-67):** Shell script wrapper for HOME isolation, session ID argument passing, stdin/stdout capture, graceful cleanup on app quit

**Non-Functional Requirements:**

| Category | Requirements |
|----------|-------------|
| Performance | App startup < 3s, session load < 1s, sub-agent expansion < 100ms, child spawn < 500ms, real-time streaming with no lag |
| Reliability | Zero data loss, user input preserved on spawn failure, graceful child cleanup on app quit |
| Integration | File watcher on isolated HOME's .claude folder (only when child runs), shell script manages child lifecycle |

**Scale & Complexity:**

- Primary domain: Desktop App (Electron)
- Complexity level: Medium
- Estimated architectural components: ~8-10 major subsystems (shell, plugins, sessions, conversation renderer, child process manager via shell script, state reader, file watcher, IPC layer)

### Technical Constraints & Dependencies

- **Electron framework:** Main process + renderer process architecture
- **Claude Code CLI:** External dependency - managed via shell script wrapper with HOME isolation
- **Shell script architecture:** Script manages HOME isolation and child lifecycle; app is a *reader* of state, not controller
- **File system:** Isolated HOME's .claude folder for session data (read-only consumption by app)
- **macOS primary:** Phase 1 targets macOS, architecture must not block future Windows/Linux
- **Local-first:** No cloud dependencies, all data on user machine
- **Offline capable:** History browsing works offline, CC execution requires network

### Cross-Cutting Concerns Identified

1. **Child Process Lifecycle:** Shell script controls spawn/stop. App reads state from .claude files or dedicated status file. Configurable idle timeout (0 to 10 min, default 0) in Sessions plugin settings.

2. **Waiting State Detection:** Investigate detecting "waiting for input" from .claude session file patterns - last message from Claude with no active streaming indicates waiting state.

3. **Status Communication:** Consider dedicated `session-status.json` in isolated HOME for app to read child state (pid, state, sessionId) - decouples CC file format from app needs.

4. **File Watcher Scope:** Watch only isolated HOME's .claude folder. Changes only occur when our child process runs - simpler scope than watching global ~/.claude/projects/.

5. **Plugin Architecture:** Define core plugin patterns *before* building Sessions plugin. Build only what Sessions needs in the API; extract reusable patterns when second plugin arrives.

6. **Visual Indicators:** Active child process shown in session list (green dot). Graceful cleanup of all children on app quit.

7. **State Persistence:** Deferred concern - future features will manage state inside Grimoire, not relying on CC's state.

### Testing Strategy (MVP)

- Lean approach for first version
- Happy path integration tests for core flows
- Manual testing corpus for session file parsing edge cases
- Defer comprehensive test automation to post-MVP

## Starter Template Evaluation

### Primary Technology Domain

**Desktop App (Electron)** with React renderer, based on project requirements for an Obsidian-inspired visual client for Claude Code.

### Technical Preferences Established

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | React + TypeScript | Component model, ecosystem, team familiarity |
| Build Tool | Vite (via electron-vite) | Fast HMR, modern ESM support |
| Styling | Tailwind CSS v4 | Utility-first, dark-mode native, UX spec recommendation |
| Components | Radix UI | Headless, accessible, full styling control |
| State (runtime) | Zustand | Minimal boilerplate, ~3KB, transient UI state only |
| State (persistent) | SQLite (better-sqlite3) | Single DB for all data, externally queryable |
| Packaging | electron-builder | Mature, DMG/NSIS/code signing support |
| Testing | Vitest + Testing Library | AI-automatable, fast, Vite-native |

### Selected Starter: electron-vite (react-ts template)

**Rationale:**
- Native Vite integration with mature, stable implementation
- Single config file for main, renderer, and preload scripts
- True HMR for renderer + hot reload for main/preload
- Better ESM support than Electron Forge's experimental Vite plugin
- Uses electron-builder for packaging (battle-tested)

**Initialization Commands:**

```bash
# Create project with React + TypeScript template
npm create @quick-start/electron@latest grimoire -- --template react-ts

cd grimoire

# Add Tailwind CSS v4
npm install -D tailwindcss @tailwindcss/vite

# Add Radix UI primitives
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-tabs

# Add Zustand for runtime UI state
npm install zustand

# Add SQLite for persistent data
npm install better-sqlite3
npm install -D @types/better-sqlite3
npx electron-rebuild -f -w better-sqlite3

# Add testing stack
npm install -D vitest @testing-library/react jsdom

# Add development utilities
npm install -D prettier eslint
```

### State Architecture

| Layer | Solution | Purpose |
|-------|----------|---------|
| **Persistent** | SQLite | Sessions, settings, plugin config - externally queryable |
| **Runtime UI** | Zustand | Panel visibility, selected tab, transient state |
| **Main process** | Plain objects | Child process registry, watcher status |

**Database location:** `~/.grimoire/grimoire.db`

**Schema file:** `src/shared/db/schema.sql`

### Data Fetching Pattern (MVP)

**Polling with 1-2 second interval** - simple, reliable, ship first.

```typescript
// MVP approach - optimize to events later if needed
useEffect(() => {
  const poll = setInterval(async () => {
    const sessions = await window.grimoireAPI.sessions.list()
    setSessionStore(sessions)
  }, 2000)
  return () => clearInterval(poll)
}, [])
```

Event-driven updates deferred to optimization phase.

### Plugin Architecture (MVP)

**Static imports, folder convention only.** No dynamic runtime loading for Phase 1.

- `plugins/` is organizational structure for future-proofing
- Code imported directly into main bundle
- True dynamic plugin system is future scope

```typescript
// src/main/plugin-loader.ts (MVP)
import { SessionsPlugin } from '../../plugins/sessions/src/main'
export const plugins = [SessionsPlugin]
```

```typescript
// Path alias for clean imports
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@plugins/*": ["./plugins/*"]
    }
  }
}
```

### IPC Architecture

Typed contextBridge via shared types - simple request/response for MVP.

```typescript
// src/shared/types/ipc.ts
export interface GrimoireAPI {
  sessions: {
    list: () => Promise<Session[]>
    spawn: (sessionId: string) => Promise<void>
    kill: (sessionId: string) => Promise<void>
  }
  db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  }
}
```

### Testing Configuration

**AI-automatable validation:**
```json
{
  "scripts": {
    "validate": "tsc --noEmit && vitest run && npm run lint"
  }
}
```

**Vitest config with environment separation:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['**/main/**/*.test.ts', 'node'],
      ['**/preload/**/*.test.ts', 'node']
    ]
  }
})
```

### Project Structure

```
grimoire/
├── CLAUDE.md
├── electron.vite.config.ts
├── vitest.config.ts
├── tsconfig.json                  ← includes @plugins/* path alias
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   └── plugin-loader.ts       ← Static plugin imports
│   ├── preload/
│   │   └── index.ts
│   ├── renderer/
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── core/
│   │       │   ├── shell/
│   │       │   ├── loading/
│   │       │   └── settings/
│   │       └── shared/
│   │           ├── hooks/
│   │           ├── store/         ← Zustand stores
│   │           └── utils/
│   └── shared/
│       ├── types/
│       │   └── ipc.ts
│       └── db/
│           └── schema.sql
├── plugins/
│   └── sessions/
│       ├── AGENTS.md
│       ├── scripts/
│       │   └── run-claude.sh
│       ├── src/
│       │   ├── main/
│       │   ├── renderer/
│       │   └── shared/
│       └── README.md
└── scripts/
```

### Architecture Principles

1. **Feature folders are autonomous** - Independently understandable by AI
2. **Colocate tests** - `Feature.test.ts` next to `Feature.tsx`
3. **Plugins kept flat** - 2-3 levels max, static imports for MVP
4. **Shared UI strategy** - Start in plugin, extract when second consumer appears
5. **Ship then optimize** - Polling before events, static before dynamic
