# Story 4-2: Offline Mode and Status Indication

## Status: ready-for-dev

---

## User Story

**As a** user,
**I want** to use Grimoire offline for browsing history,
**So that** I can review past sessions even without internet.

---

## Acceptance Criteria

### AC1: Offline Read-Only Operations
**Given** the user has no internet connection (FR13)
**When** using Grimoire
**Then** read-only operations work (browse sessions, view conversations)
**And** the session list loads from database without network dependency
**And** conversation files can be read from CLAUDE_CONFIG_DIR

### AC2: Send Message Blocked When Offline
**Given** the user is offline
**When** attempting to send messages
**Then** a clear error message displays explaining internet is required
**And** the send button is disabled with tooltip explaining why
**And** the error suggests checking connectivity

### AC3: Network Status Indicator
**Given** network status changes (FR14)
**When** going online or offline
**Then** a status indicator updates in the UI (subtle, non-intrusive)
**And** the indicator shows current connectivity state
**And** the indicator is positioned in a consistent location (e.g., status bar or ribbon)

### AC4: CC Spawn Blocked When Offline
**Given** the user is offline
**When** trying to spawn CC process
**Then** a clear error message displays: "Internet connection required to use Claude Code"
**And** the message appears in the conversation as a system message
**And** the user can retry when connectivity returns

### AC5: Graceful Degradation
**Given** the user goes offline mid-session
**When** a CC process is already running
**Then** the process continues (CC handles its own connectivity)
**And** if CC fails due to network, error is displayed in conversation
**And** session returns to Idle state

---

## Technical Requirements

### Files to Create
- `src/main/network-monitor.ts` - Network status monitoring
- `src/main/network-monitor.test.ts` - Tests
- `src/renderer/src/shared/hooks/useNetworkStatus.ts` - Network status hook
- `src/renderer/src/shared/hooks/useNetworkStatus.test.ts` - Tests
- `src/renderer/src/shared/components/NetworkIndicator.tsx` - Status indicator component
- `src/renderer/src/shared/components/NetworkIndicator.test.tsx` - Tests

### Files to Modify
- `src/main/sessions/cc-spawner.ts` - Add online check before spawn
- `src/main/ipc/sessions.ts` - Add network check to sendMessage handler
- `src/main/ipc/index.ts` - Register network IPC handlers
- `src/preload/index.ts` - Expose network IPC channels
- `src/renderer/src/features/sessions/components/ChatInput.tsx` - Disable when offline
- `src/renderer/src/core/shell/Shell.tsx` - Add NetworkIndicator to layout

### IPC Channels (following namespace:action pattern)
```typescript
// Request channels (renderer -> main)
'network:getStatus' // Get current online/offline status

// Response events (main -> renderer)
'network:statusChanged' // { online: boolean }
```

### State Management
```typescript
// Zustand store extension or separate store
interface NetworkState {
  online: boolean
  lastChecked: number
}

// Could be part of useUIStore or separate useNetworkStore
```

---

## Implementation Tasks

### Task 1: Create Network Monitor in Main Process [AC3, AC5]
**Files:** `src/main/network-monitor.ts`, `network-monitor.test.ts`

1. Use Electron's `powerMonitor` or native network check
2. Implement `checkOnlineStatus()` using `dns.resolve('8.8.8.8')` or similar
3. Subscribe to system network change events
4. Emit `network:statusChanged` events when status changes
5. Export `isOnline()` function for synchronous checks

**Implementation:**
```typescript
import { net } from 'electron'
import { emitToRenderer } from './sessions/stream-parser'

let cachedOnline = true

export function isOnline(): boolean {
  return cachedOnline
}

export function startNetworkMonitoring(): void {
  // Use Electron's net.online property or polling
  setInterval(async () => {
    const newStatus = net.isOnline() // Electron 12+
    if (newStatus !== cachedOnline) {
      cachedOnline = newStatus
      emitToRenderer('network:statusChanged', { online: newStatus })
    }
  }, 5000) // Check every 5 seconds
}
```

**Tests:**
- Returns true when network available
- Returns false when network unavailable
- Emits event on status change

### Task 2: Register Network IPC Handlers [AC3]
**Files:** `src/main/ipc/network.ts`, `src/main/ipc/index.ts`, `src/preload/index.ts`

1. Create `registerNetworkIPC()` in new `src/main/ipc/network.ts`
2. Implement `network:getStatus` handler returning current status
3. Register in `src/main/ipc/index.ts`
4. Expose in preload contextBridge
5. Start network monitoring in main process initialization

### Task 3: Create useNetworkStatus Hook [AC3]
**Files:** `src/renderer/src/shared/hooks/useNetworkStatus.ts`, `useNetworkStatus.test.ts`

1. Query initial status on mount via `window.grimoireAPI.network.getStatus()`
2. Listen for `network:statusChanged` events
3. Return `{ online: boolean, lastChecked: number }`
4. Cleanup listener on unmount

**Tests:**
- Returns initial status from IPC
- Updates on statusChanged events
- Cleans up listener

### Task 4: Create NetworkIndicator Component [AC3]
**Files:** `src/renderer/src/shared/components/NetworkIndicator.tsx`, `NetworkIndicator.test.tsx`

1. Small indicator showing online/offline status
2. Online: green dot or WiFi icon (subtle, muted)
3. Offline: red dot or crossed WiFi icon (more visible)
4. Tooltip showing "Online" or "Offline - Some features unavailable"
5. Position: bottom-right of ribbon or in status area

**Styling:**
```tsx
// Subtle indicator - only attention-grabbing when offline
<div className={cn(
  "w-2 h-2 rounded-full transition-colors",
  online ? "bg-green-500/50" : "bg-red-500 animate-pulse"
)} />
```

**Tests:**
- Shows green indicator when online
- Shows red indicator when offline
- Tooltip shows correct text

### Task 5: Add Network Check to CC Spawner [AC2, AC4]
**Files:** `src/main/sessions/cc-spawner.ts`

1. Import `isOnline()` from network-monitor
2. Check online status at start of `spawnCC()`
3. If offline, emit error event and return early without spawning
4. Error message: "Internet connection required to use Claude Code"

**Implementation:**
```typescript
export function spawnCC(options: SpawnOptions): ChildProcess | null {
  if (!isOnline()) {
    const errorId = options.sessionId ?? `pending-${Date.now()}`
    emitToRenderer('stream:end', {
      sessionId: errorId,
      success: false,
      error: 'Internet connection required to use Claude Code. Please check your network connection and try again.'
    })
    return null
  }
  // ... existing spawn logic
}
```

### Task 6: Update ChatInput for Offline State [AC2]
**Files:** `src/renderer/src/features/sessions/components/ChatInput.tsx`

1. Import `useNetworkStatus` hook
2. Disable send button when offline
3. Show tooltip on disabled button: "Internet required to send messages"
4. Keep input field enabled for typing (user can prepare message)
5. Optionally show subtle inline message below input

**Tests:**
- Send button disabled when offline
- Tooltip shows offline message
- Button re-enables when online

### Task 7: Integrate NetworkIndicator into Shell [AC3]
**Files:** `src/renderer/src/core/shell/Shell.tsx`

1. Import NetworkIndicator component
2. Add to ribbon bottom or status bar area
3. Ensure it doesn't interfere with existing layout
4. Position consistently across all views

---

## Dev Notes

### Architecture Patterns to Follow
- IPC channels follow `namespace:action` pattern per architecture doc
- Reuse `emitToRenderer()` from stream-parser for events
- Network state can live in existing useUIStore or new dedicated store

### File Locations
- Network monitor: `src/main/network-monitor.ts`
- IPC handlers: `src/main/ipc/network.ts`
- Hook: `src/renderer/src/shared/hooks/useNetworkStatus.ts`
- Component: `src/renderer/src/shared/components/NetworkIndicator.tsx`

### Testing Approach
- Mock `electron.net.isOnline()` for network monitor tests
- Mock IPC in hook tests
- Visual tests for indicator component states

### Existing Code to Reuse
- `emitToRenderer()` from `src/main/sessions/stream-parser.ts`
- `cc-spawner.ts` error handling patterns
- `ChatInput.tsx` disabled state patterns (already handles Working state)

### Previous Story Context (4-1)
- Story 4-1 adds startup verification that also checks CC availability
- Network check is complementary - 4-1 checks if claude installed, 4-2 checks if network available
- Both emit error events to renderer for display

### Dependencies
- Story 4-1 must be completed first (sets up startup flow)
- NetworkIndicator should integrate with Shell layout from Epic 1
- ChatInput already has disabled states from Epic 3a

### Known Constraints
- Electron's `net.isOnline()` is available in Electron 12+
- Polling interval of 5 seconds balances responsiveness with CPU usage
- CC process handles its own network errors once spawned

### Graceful Degradation Notes
- All database operations work offline (SQLite is local)
- Session list, conversation viewing, and navigation are fully offline-capable
- Only CC spawn/send operations require network
- Running CC processes continue until they complete or fail on their own

---

## Definition of Done

- [ ] Network status is detected and tracked in main process
- [ ] NetworkIndicator shows current online/offline status
- [ ] Indicator is subtle when online, more visible when offline
- [ ] ChatInput send button disabled when offline with tooltip
- [ ] CC spawn blocked when offline with clear error message
- [ ] Error message appears in conversation view
- [ ] Session list and conversations viewable offline
- [ ] Status updates when network changes (within 5 seconds)
- [ ] All tests pass: `npm run validate`
- [ ] Test coverage for online/offline transitions
