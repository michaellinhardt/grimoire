# Story 1.2: Core Shell Layout with Ribbon and Panels

Status: ready-for-dev

## Story

As a **user**,
I want **the main application shell with ribbon navigation, resizable panels, and tab bar**,
so that **I have the foundational UI structure for navigating sessions and viewing content**.

## Acceptance Criteria

1. **Given** the app launches **When** the main window renders **Then** the shell displays: fixed ribbon (48px), collapsible left panel (280px default), flexible middle panel, collapsible right panel (300px default)
2. **Given** the user clicks a ribbon icon **When** the click is processed **Then** the appropriate section becomes active with visual indication (accent background)
3. **Given** the user clicks a panel's door button **When** the panel is open **Then** the panel collapses (200ms ease-out) and middle panel expands to fill space
4. **Given** the user clicks the door button again **When** the panel is collapsed **Then** the panel expands to its previous width
5. **Given** a side panel is collapsed **When** viewing the middle panel **Then** the collapsed panel's door button appears in the middle panel topbar (TabBar area)
6. **Given** the user drags a panel resize handle **When** dragging horizontally **Then** the panel resizes within min/max constraints (Left: 240-320px, Right: 260-340px)
7. **Given** multiple tabs exist **When** the user clicks a tab **Then** that tab becomes active with visual indication
8. **Given** the user clicks the "+" button in the tab bar **When** clicked **Then** a new session tab is created and becomes active
9. **Given** the user clicks the "×" on a tab **When** clicked **Then** that tab closes and the previous tab becomes active
10. **Given** the window is resized below 800×600px **When** at minimum size **Then** the window stops resizing (minimum enforced)
11. All components use CSS custom properties defined in Story 1.1's design system
12. **Given** the user navigates with keyboard **When** pressing Tab **Then** focus moves in logical order: Ribbon → Left Panel → TabBar → Middle Panel → Right Panel
13. **Given** the user focuses a Ribbon button **When** pressing Arrow Up/Down **Then** focus moves between Ribbon buttons
14. **Given** the user focuses the TabBar **When** pressing Arrow Left/Right **Then** focus moves between tabs

## Tasks / Subtasks

- [ ] Task 1: Install dependencies (AC: 6, 2)
  - [ ] Run `npm install react-resizable-panels lucide-react clsx tailwind-merge`
  - [ ] Create `src/renderer/src/shared/utils/cn.ts` with className merge utility
  - [ ] Verify imports work in renderer process

- [ ] Task 2: Create Shell layout component (AC: 1)
  - [ ] Create `src/renderer/src/core/shell/Shell.tsx` as the root layout component
  - [ ] Implement 4-region layout: Ribbon (fixed) + Left (collapsible) + Middle (flex) + Right (collapsible)
  - [ ] Use PanelGroup with `autoSaveId="grimoire-shell"` for size persistence
  - [ ] Apply CSS variables for backgrounds: `var(--bg-base)`, `var(--bg-elevated)`
  - [ ] Set minimum window dimensions in `src/main/index.ts`: 800×600px

- [ ] Task 3: Create Ribbon component (AC: 2)
  - [ ] Create `src/renderer/src/core/shell/Ribbon.tsx`
  - [ ] Implement fixed 48px width with vertical icon buttons
  - [ ] Use lucide-react icons: `MessagesSquare` (Sessions), `Settings` (Settings)
  - [ ] Create RibbonButton with states: default (muted), hover (elevated), active (accent)
  - [ ] Implement Radix Tooltip on hover showing section name
  - [ ] Wire click to `useUIStore.setActiveSection()`

- [ ] Task 4: Create Panel component with collapse/expand (AC: 3, 4, 5)
  - [ ] Create `src/renderer/src/core/shell/Panel.tsx` as a reusable panel wrapper
  - [ ] Create `src/renderer/src/core/shell/PanelTopbar.tsx` with tabs/buttons area
  - [ ] Use `useRef<ImperativePanelHandle>` for programmatic collapse/expand
  - [ ] Implement door button in topbar (right side)
  - [ ] Store panel state in `useUIStore`: `leftPanelCollapsed`, `rightPanelCollapsed`
  - [ ] Sync store state with panel ref: call `panelRef.current.collapse()` or `.expand()`

- [ ] Task 5: Implement resize constraints (AC: 6)
  - [ ] Set Left panel: `defaultSize={20}`, `minSize={17}`, `maxSize={23}` (~240-320px at 1400px width)
  - [ ] Set Right panel: `defaultSize={21}`, `minSize={19}`, `maxSize={24}` (~260-340px at 1400px width)
  - [ ] Style resize handle: 4px width, visible on hover (`var(--bg-hover)`)
  - [ ] Middle panel minimum enforced by window min-width (800px), not panel constraint

- [ ] Task 6: Create TabBar component (AC: 5, 7, 8, 9)
  - [ ] Create `src/renderer/src/core/shell/TabBar.tsx`
  - [ ] Implement tab states: default (muted), hover (elevated + × visible), active (accent underline)
  - [ ] Add "+" button at end of tab list
  - [ ] Implement tab close behavior: previous tab becomes active (or next if closing first)
  - [ ] Render collapsed panel door buttons in TabBar when panels are collapsed
  - [ ] Implement horizontal scroll for overflow tabs

- [ ] Task 7: Update Zustand store for shell state (AC: 2, 3, 4, 7)
  - [ ] RENAME existing `leftPanelOpen` → `leftPanelCollapsed` (invert logic)
  - [ ] RENAME existing `rightPanelOpen` → `rightPanelCollapsed` (invert logic)
  - [ ] RENAME existing `setActiveTab` → `setActiveTabId` (consistency)
  - [ ] Add: `activeSection: 'sessions' | 'settings'` with `setActiveSection()`
  - [ ] Add: `tabs: Tab[]` with `addTab()`, `closeTab()`
  - [ ] Define Tab type: `{ id: string, type: 'session' | 'subagent' | 'file', title: string }`
  - [ ] Update existing tests to use new property names

- [ ] Task 8: Wire App.tsx to Shell (AC: 1, 10)
  - [ ] Wrap app with `<Tooltip.Provider delayDuration={300}>`
  - [ ] Update `src/renderer/src/App.tsx` to render `<Shell />` as root
  - [ ] Remove placeholder content from Story 1.1
  - [ ] Verify layout renders correctly at various window sizes

- [ ] Task 9: Add placeholder content panels (AC: 1)
  - [ ] Create `src/renderer/src/core/shell/LeftPanelContent.tsx` with "Sessions" placeholder
  - [ ] Create `src/renderer/src/core/shell/MiddlePanelContent.tsx` with "Conversation" placeholder
  - [ ] Create `src/renderer/src/core/shell/RightPanelContent.tsx` with "Info/Events" placeholder
  - [ ] Apply appropriate background colors per panel region

- [ ] Task 10: Final validation (AC: all)
  - [ ] Run `npm run validate` (tsc + vitest + lint)
  - [ ] Manually test all panel interactions (collapse, expand, resize)
  - [ ] Manually test all tab interactions (add, close, switch)
  - [ ] Verify door buttons appear in TabBar when side panels collapsed
  - [ ] Verify keyboard navigation: Tab order (Ribbon → Left → TabBar → Middle → Right)
  - [ ] Verify keyboard navigation: Arrow keys within Ribbon buttons (Up/Down)
  - [ ] Verify keyboard navigation: Arrow keys within TabBar (Left/Right)
  - [ ] Verify all interactive elements have visible focus indicators
  - [ ] Verify no console errors or warnings

## Dev Notes

### Dependencies to Install

```bash
npm install react-resizable-panels lucide-react clsx tailwind-merge
```

| Package | Purpose |
|---------|---------|
| react-resizable-panels | Resizable, collapsible panel layout with keyboard support |
| lucide-react | Icon library (tree-shakeable, shadcn/ui ecosystem) |
| clsx + tailwind-merge | className merge utility for conditional Tailwind classes |

### cn() Utility Function

```typescript
// src/renderer/src/shared/utils/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Shell Layout with Panel Refs

```typescript
// src/renderer/src/core/shell/Shell.tsx
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels'
import { useRef, useEffect } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'

export function Shell() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const { leftPanelCollapsed, rightPanelCollapsed } = useUIStore()

  // Sync store state with panel
  useEffect(() => {
    if (leftPanelCollapsed) {
      leftPanelRef.current?.collapse()
    } else {
      leftPanelRef.current?.expand()
    }
  }, [leftPanelCollapsed])

  useEffect(() => {
    if (rightPanelCollapsed) {
      rightPanelRef.current?.collapse()
    } else {
      rightPanelRef.current?.expand()
    }
  }, [rightPanelCollapsed])

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      <Ribbon />
      <PanelGroup direction="horizontal" autoSaveId="grimoire-shell" className="flex-1">
        <Panel
          ref={leftPanelRef}
          id="left"
          defaultSize={20}
          minSize={17}
          maxSize={23}
          collapsible
          collapsedSize={0}
        >
          <LeftPanelContent />
        </Panel>
        <PanelResizeHandle className="w-1 bg-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors" />
        <Panel id="middle" minSize={30}>
          <div className="flex flex-col h-full">
            <TabBar />
            <MiddlePanelContent />
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors" />
        <Panel
          ref={rightPanelRef}
          id="right"
          defaultSize={21}
          minSize={19}
          maxSize={24}
          collapsible
          collapsedSize={0}
        >
          <RightPanelContent />
        </Panel>
      </PanelGroup>
    </div>
  )
}
```

### Ribbon with Lucide Icons

```typescript
// src/renderer/src/core/shell/Ribbon.tsx
import { MessagesSquare, Settings } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@renderer/shared/utils/cn'
import { useUIStore } from '@renderer/shared/store/useUIStore'

export function Ribbon() {
  const { activeSection, setActiveSection } = useUIStore()

  return (
    <div className="w-12 flex flex-col items-center py-2 gap-1 bg-[var(--bg-base)] border-r border-[var(--border)]">
      <RibbonButton
        icon={<MessagesSquare size={20} />}
        label="Sessions"
        active={activeSection === 'sessions'}
        onClick={() => setActiveSection('sessions')}
      />
      <RibbonButton
        icon={<Settings size={20} />}
        label="Settings"
        active={activeSection === 'settings'}
        disabled
        onClick={() => {}}
      />
    </div>
  )
}

interface RibbonButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function RibbonButton({ icon, label, active, disabled, onClick }: RibbonButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "w-[34px] h-[34px] flex items-center justify-center rounded-[var(--radius-sm)]",
            "text-[var(--text-muted)] transition-colors",
            !disabled && "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
            active && "bg-[var(--accent)] text-white",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="px-2 py-1 text-sm bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)]"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
```

### Zustand Store (Complete Interface)

```typescript
// src/renderer/src/shared/store/useUIStore.ts
import { create } from 'zustand'

interface Tab {
  id: string
  type: 'session' | 'subagent' | 'file'
  title: string
}

interface UIState {
  // Panel state (RENAMED from leftPanelOpen/rightPanelOpen)
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean

  // Tab state
  tabs: Tab[]
  activeTabId: string | null

  // Section state
  activeSection: 'sessions' | 'settings'

  // Actions
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  setActiveSection: (section: 'sessions' | 'settings') => void
  addTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTabId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  tabs: [],
  activeTabId: null,
  activeSection: 'sessions',

  // Actions
  setLeftPanelCollapsed: (collapsed) => set({ leftPanelCollapsed: collapsed }),
  setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
  setActiveSection: (section) => set({ activeSection: section }),

  addTab: (tab) => set((state) => ({
    tabs: [...state.tabs, tab],
    activeTabId: tab.id
  })),

  closeTab: (id) => set((state) => {
    const index = state.tabs.findIndex(t => t.id === id)
    const newTabs = state.tabs.filter(t => t.id !== id)

    // Select previous tab, or next if closing first, or null if empty
    let newActiveId: string | null = null
    if (newTabs.length > 0) {
      if (state.activeTabId === id) {
        newActiveId = index > 0 ? newTabs[index - 1].id : newTabs[0].id
      } else {
        newActiveId = state.activeTabId
      }
    }

    return { tabs: newTabs, activeTabId: newActiveId }
  }),

  setActiveTabId: (id) => set({ activeTabId: id })
}))
```

### TabBar with Collapsed Panel Door Buttons

```typescript
// src/renderer/src/core/shell/TabBar.tsx
import { PanelLeft, PanelRight, Plus, X } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { useUIStore } from '@renderer/shared/store/useUIStore'

export function TabBar() {
  const {
    tabs, activeTabId, addTab, closeTab, setActiveTabId,
    leftPanelCollapsed, rightPanelCollapsed,
    setLeftPanelCollapsed, setRightPanelCollapsed
  } = useUIStore()

  return (
    <div className="h-10 flex items-center border-b border-[var(--border)] bg-[var(--bg-elevated)]">
      {/* Left door button when panel collapsed */}
      {leftPanelCollapsed && (
        <button
          onClick={() => setLeftPanelCollapsed(false)}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          aria-label="Show left panel"
        >
          <PanelLeft size={16} />
        </button>
      )}

      {/* Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "group h-full px-3 flex items-center gap-2 border-r border-[var(--border)]",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              tab.id === activeTabId && "text-[var(--text-primary)] border-b-2 border-b-[var(--accent)]"
            )}
          >
            <span className="text-sm truncate max-w-[120px]">{tab.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
              aria-label="Close tab"
            >
              <X size={12} />
            </button>
          </button>
        ))}
      </div>

      {/* Add tab button */}
      <button
        onClick={() => addTab({ id: crypto.randomUUID(), type: 'session', title: 'New Session' })}
        className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        aria-label="New tab"
      >
        <Plus size={16} />
      </button>

      {/* Right door button when panel collapsed */}
      {rightPanelCollapsed && (
        <button
          onClick={() => setRightPanelCollapsed(false)}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          aria-label="Show right panel"
        >
          <PanelRight size={16} />
        </button>
      )}
    </div>
  )
}
```

### App.tsx with Tooltip Provider

```typescript
// src/renderer/src/App.tsx
import * as Tooltip from '@radix-ui/react-tooltip'
import { Shell } from './core/shell'

function App(): React.ReactElement {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Shell />
    </Tooltip.Provider>
  )
}

export default App
```

### Minimum Window Size (Electron)

```typescript
// src/main/index.ts - in createWindow()
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  // ... rest of config
})
```

### Project Structure

**New files:**
```
src/renderer/src/
├── shared/utils/
│   └── cn.ts                  # className merge utility
└── core/shell/
    ├── Shell.tsx              # Root layout component
    ├── Ribbon.tsx             # Fixed left navigation
    ├── Panel.tsx              # Reusable panel wrapper (optional)
    ├── PanelTopbar.tsx        # Panel header with door button
    ├── TabBar.tsx             # Session tabs + collapsed door buttons
    ├── LeftPanelContent.tsx   # Placeholder
    ├── MiddlePanelContent.tsx # Placeholder
    ├── RightPanelContent.tsx  # Placeholder
    └── index.ts               # Barrel export
```

**Modified files:**
```
src/renderer/src/App.tsx                    # Add Tooltip.Provider, render Shell
src/renderer/src/shared/store/useUIStore.ts # Rename properties, add new state
src/main/index.ts                           # Add minWidth/minHeight
```

### Keyboard Navigation Requirements

Per UX spec (UX14): "Keyboard navigation throughout (Tab, Enter, Escape, Arrow keys)"

**Tab Order:** Ribbon → LeftPanel → TabBar → MiddlePanel → RightPanel

**Component-Specific Keyboard Handling:**

| Component | Key | Action |
|-----------|-----|--------|
| Ribbon | Arrow Up/Down | Move focus between ribbon buttons |
| Ribbon | Enter/Space | Activate focused button |
| TabBar | Arrow Left/Right | Move focus between tabs |
| TabBar | Enter/Space | Activate focused tab |
| TabBar | Delete/Backspace | Close focused tab (optional) |
| Panels | - | Natural tab order within content |

**Focus Indicators:**
- All interactive elements must have visible focus ring
- Use `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` pattern
- Radix components provide focus management automatically

**Implementation Notes:**
- Radix Tooltip handles focus correctly (doesn't steal focus)
- react-resizable-panels has built-in keyboard resize support (arrow keys on handle)
- Use `tabIndex={0}` only on custom interactive elements, not on native buttons

### Architecture Compliance

- Components: PascalCase (`Shell.tsx`, `Ribbon.tsx`, `TabBar.tsx`)
- Store: `useUIStore.ts` pattern
- Tests: Colocated (`useUIStore.test.ts`)
- State: All in Zustand (no React.useState for shared state)
- CSS: Custom properties from design system
- Icons: lucide-react (tree-shakeable)

### Testing Requirements

- Unit tests for all `useUIStore` actions (update existing tests for renamed properties)
- Test `closeTab` selects correct next tab (previous, or next if first, or null if empty)
- Test panel collapse/expand state changes
- Manual: Keyboard navigation, door buttons in TabBar when collapsed

### Future Scope (Not This Story)

- Keyboard shortcuts (Cmd+/ for panel toggle)
- Panel drag-to-resize persistence already handled by `autoSaveId`

### References

- [Source: architecture.md#Core Application Structure] - Shell as root layout
- [Source: architecture.md#Implementation Patterns] - Naming conventions
- [Source: ux-design-specification.md#Panel (Left/Right)] - Dimensions, collapse behavior
- [Source: ux-design-specification.md#Ribbon] - 48px fixed, icon button specs
- [Source: ux-design-specification.md#Tab Bar] - Tab states, door button placement
- [Source: ux-design-specification.md#Responsive Strategy] - 800×600 minimum
- [Source: ux-design-specification.md#Design System Requirements] - Keyboard accessibility critical
- [Source: architecture.md#From UX Design - Interaction Patterns] - UX14 keyboard navigation
- [Source: epics.md#Story 1.2] - Acceptance criteria

### Web Research (2026-01-22)

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - `autoSaveId` for persistence, `ImperativePanelHandle` for programmatic control
- [shadcn/ui Resizable](https://ui.shadcn.com/docs/components/resizable) - Pattern reference
- [lucide-react](https://lucide.dev/) - Icon library

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### Change Log

### File List
