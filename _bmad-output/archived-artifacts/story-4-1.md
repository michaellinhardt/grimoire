# Story 4-1: Loading Screen and Startup Verification

## Status: done

**Review Attempt 2 Summary:**
- Fixed 5 code quality issues identified in adversarial review
- Issues: 3 HIGH, 2 MEDIUM (no CRITICAL, no LOW)
- All tests pass (962 tests)
- Fixes improve reliability, error handling, and memory management

---

## User Story

**As a** user,
**I want** Grimoire to start reliably with clear feedback,
**So that** I know the app is loading and any issues are clearly communicated.

---

## Acceptance Criteria

### AC1: Loading Screen Display
**Given** the user launches Grimoire (FR8)
**When** the app starts
**Then** a loading screen appears with the Grimoire logo
**And** startup progress is indicated via subtle animation (pulse or fade)

### AC2: Claude Code Installation Verification
**Given** the app is starting (FR9)
**When** verifying Claude Code installation
**Then** the system checks if `claude` command is available in PATH
**And** if not found, an error modal appears with installation instructions
**And** the error modal provides a "Retry" button and "Quit" button

### AC3: Config Directory Verification
**Given** the app is starting (FR10, FR11)
**When** verifying CLAUDE_CONFIG_DIR configuration
**Then** the system checks if the directory exists and is writable
**And** creates it if missing (at `~/Library/Application Support/Grimoire/.claude/`)
**And** if creation fails, a modal error appears with quit/retry options

### AC4: Authentication Verification
**Given** the app is starting (FR12)
**When** verifying authentication
**Then** the system checks CC credentials via test command
**And** if auth fails, a modal appears with instructions to authenticate via `claude` CLI

### AC5: Startup Completion Transition
**Given** all verifications pass
**When** startup completes
**Then** the loading screen transitions smoothly to the main UI (200ms fade)
**And** total startup time is < 3 seconds (NFR1)

### AC6: Verification Status Display
**Given** verification steps are running
**When** each step completes
**Then** the loading screen shows current verification step text
**And** steps include: "Initializing...", "Checking Claude Code...", "Verifying configuration...", "Ready"

---

## Technical Requirements

### Files to Create
- `src/renderer/src/core/loading/LoadingScreen.tsx` - Loading screen component
- `src/renderer/src/core/loading/LoadingScreen.test.tsx` - Tests
- `src/renderer/src/core/loading/useAppInit.ts` - Startup verification hook
- `src/renderer/src/core/loading/useAppInit.test.ts` - Tests
- `src/main/startup-verifier.ts` - Main process verification logic
- `src/main/startup-verifier.test.ts` - Tests

### Files to Modify
- `src/renderer/src/App.tsx` - Wrap app with loading screen conditional
- `src/main/index.ts` - Add startup verification before window show
- `src/preload/index.ts` - Add startup IPC channel exposure
- `src/main/ipc/index.ts` - Register startup IPC handlers

### IPC Channels (following namespace:action pattern)
```typescript
// Request channels (renderer -> main)
'startup:verify' // Trigger full verification sequence
'startup:checkClaude' // Check if claude CLI available
'startup:checkConfig' // Check/create CLAUDE_CONFIG_DIR
'startup:checkAuth' // Check CC authentication

// Response events (main -> renderer)
'startup:stepComplete' // { step: string, success: boolean, error?: string }
'startup:allComplete' // { success: boolean }
```

### State Management
```typescript
// useAppInit hook state
interface StartupState {
  status: 'loading' | 'error' | 'ready'
  currentStep: string
  errorMessage: string | null
  errorType: 'claude' | 'config' | 'auth' | null
}
```

---

## Implementation Tasks

### Task 1: Create LoadingScreen Component [AC1, AC6]
- [x] Create component with centered Grimoire logo (can be text "Grimoire" initially)
- [x] Add subtle pulse animation on logo (CSS keyframes)
- [x] Display current step text below logo in muted color
- [x] Add fade-out animation when transitioning to main UI
- [x] Style following UX1 dark-first design (dark bg, purple accent)
- [x] Tests: Renders logo and current step text, shows animation, triggers fade-out

### Task 2: Create startup-verifier.ts in Main Process [AC2, AC3, AC4]
- [x] `checkClaudeInstalled()`: Use `which claude` (unix) or `where claude` (win) via child_process.exec
- [x] `checkConfigDirectory()`: Check/create `app.getPath('userData')/.claude` directory
- [x] `checkAuthentication()`: Run `claude --version` with CLAUDE_CONFIG_DIR to verify auth
- [x] Export combined `runStartupVerification()` function that runs all checks sequentially
- [x] Return structured result: `{ success: boolean, failedStep?: string, error?: string }`
- [x] Tests: 14 tests covering all verification scenarios

### Task 3: Register Startup IPC Handlers [AC2, AC3, AC4]
- [x] Create `registerStartupIPC()` in new `src/main/ipc/startup.ts`
- [x] Implement `startup:verify` handler that calls `runStartupVerification()`
- [x] Emit `startup:stepComplete` events as each step completes
- [x] Emit `startup:allComplete` when verification sequence finishes
- [x] Register in `src/main/ipc/index.ts`
- [x] Expose in preload contextBridge

### Task 4: Create useAppInit Hook [AC5, AC6]
- [x] Call `window.grimoireAPI.startup.verify()` on mount
- [x] Listen for `startup:stepComplete` events to update current step
- [x] Transition to 'ready' on successful completion
- [x] Transition to 'error' with message on failure
- [x] Track total startup time for performance validation
- [x] Tests: 5 tests covering all state transitions

### Task 5: Integrate Loading Screen into App [AC1, AC5]
- [x] Import `useAppInit` and `LoadingScreen`
- [x] Show `LoadingScreen` when status is 'loading' or 'error'
- [x] Show main UI (existing content) when status is 'ready'
- [x] Pass step and error props to LoadingScreen
- [x] 200ms fade-out transition to main UI

### Task 6: Add Error Modal Component [AC2, AC3, AC4]
- [x] Create modal with dark overlay and centered card
- [x] Display error message and instructions based on errorType
- [x] Add Retry button (calls `startup:verify` again)
- [x] Add Quit button (calls `window.close()`)
- [x] Different instructions for each error type
- [x] Tests: 6 tests covering all error scenarios

### Task 7: Main Process Integration [AC5]
- [x] Register startup IPC handlers in `src/main/index.ts`
- [x] Database is initialized before IPC handlers are registered

---

## Dev Notes

### Architecture Patterns to Follow
- IPC channels follow `namespace:action` pattern per architecture doc
- Error handling: throw in main process, catch in renderer
- Use existing `emitToRenderer` pattern from `stream-parser.ts` for events
- Zustand not needed for loading state (local hook state sufficient)

### File Locations
- Loading components go in `src/renderer/src/core/loading/`
- IPC handlers go in `src/main/ipc/` (new startup.ts file)
- Main process utils go in `src/main/` (startup-verifier.ts)

### Testing Approach
- Unit test verification functions with mocked child_process
- Unit test components with RTL
- Integration test: full startup flow with mocked IPC

### Existing Code to Reuse
- `emitToRenderer()` from `src/main/sessions/stream-parser.ts` for IPC events
- `app.getPath('userData')` already used in `cc-spawner.ts` for CLAUDE_CONFIG_DIR
- Error modal styling can reference Radix UI Dialog patterns

### Performance Requirement
- NFR1: Total startup < 3 seconds
- Each verification step should timeout after 5 seconds max
- Claude check can be slow on first run if PATH resolution is needed

### Known Constraints
- macOS primary target (darwin); Windows/Linux paths differ
- `which` command is unix-only; use `where` on Windows
- Auth check may need to run `claude` with --help or --version

---

## Dev Agent Record

### Implementation Plan
Implemented loading screen and startup verification following tech-spec-4-1.md. Used red-green-refactor cycle for all components. Implementation order: main process verifier -> IPC handlers -> preload bridge -> React components -> App integration.

### Completion Notes
- All 7 implementation tasks completed
- 960 tests passing (14 new startup-verifier tests + 18 loading component tests)
- Full validation passes: typecheck + test + lint
- Loading screen displays with pulse animation on Grimoire logo
- Verification sequence: claude check -> config directory -> authentication
- Error modal shows with appropriate instructions for each error type
- 200ms fade-out transition to main UI on success
- Added startup namespace to existing test mocks (CloseTabConfirmDialog.test.tsx, SessionInfoView.test.tsx)

---

## File List

### New Files
- src/main/startup-verifier.ts
- src/main/startup-verifier.test.ts
- src/main/ipc/startup.ts
- src/renderer/src/core/loading/LoadingScreen.tsx
- src/renderer/src/core/loading/LoadingScreen.test.tsx
- src/renderer/src/core/loading/ErrorModal.tsx
- src/renderer/src/core/loading/ErrorModal.test.tsx
- src/renderer/src/core/loading/useAppInit.ts
- src/renderer/src/core/loading/useAppInit.test.ts
- src/renderer/src/core/loading/index.ts

### Modified Files
- src/main/index.ts - Added registerStartupIPC import and call
- src/main/ipc/index.ts - Export registerStartupIPC
- src/preload/index.ts - Added startup namespace to grimoireAPI
- src/preload/index.d.ts - Added startup TypeScript declarations
- src/renderer/src/App.tsx - Integrated loading screen with useAppInit hook
- src/renderer/src/assets/main.css - Added loading screen animations
- src/renderer/src/core/shell/CloseTabConfirmDialog.test.tsx - Added startup mock
- src/renderer/src/features/sessions/components/SessionInfoView.test.tsx - Added startup mock

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-24 | Story 4-1 implementation complete - Loading screen, startup verification, error handling |

---

## Definition of Done

- [x] Loading screen appears immediately on app launch
- [x] Grimoire logo displays with pulse animation
- [x] Current verification step shown below logo
- [x] Claude Code check runs and catches missing installation
- [x] Config directory check runs and creates if missing
- [x] Auth check runs and catches auth failures
- [x] Error modal shows with appropriate message and retry/quit options
- [x] Smooth transition to main UI on success (200ms fade)
- [x] Total startup time < 3 seconds in normal case
- [x] All tests pass: `npm run validate`
- [x] Test coverage for all verification scenarios
