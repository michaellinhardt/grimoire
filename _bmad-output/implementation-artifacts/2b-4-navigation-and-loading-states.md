# Story 2b.4: Navigation and Loading States

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to navigate long conversations easily and see clear loading feedback**,
so that **I can find specific points in the conversation and know when Claude is working**.

## Acceptance Criteria

1. **Given** a conversation has many events (FR40) **When** the right panel shows the Events tab **Then** a navigation map displays one-line summaries for each event **And** user events are right-aligned, system events are left-aligned **And** clicking an event scrolls the conversation to that point (300ms ease-out)

2. **Given** the user sends a message and waits for response (FR41) **When** Claude is processing **Then** a non-persistent "thinking" indicator appears (animated dots or pulse) **And** the indicator disappears when response starts streaming

3. **Given** the user sends a message to an inactive session (FR42) **When** the CC child process is spawning **Then** a "Loading Claude Code..." indicator appears **And** the indicator shows subtle animation (fade pulse) **And** the indicator transitions to thinking once connected

4. **Given** a sub-agent is currently running **When** displayed in collapsed state **Then** an animated `...` indicator shows activity **And** status badge shows "Running"

## Tasks / Subtasks

- [x] Task 1: Create EventTimelineItem component (AC: 1)
  - [x] Create `src/renderer/src/features/sessions/components/EventTimelineItem.tsx`
  - [x] Props: `event: TimelineEvent`, `onClick?: () => void`
  - [x] User events: Right-aligned, accent background
  - [x] System events (assistant/tool/agent): Left-aligned, elevated background
  - [x] One-line truncated summary with timestamp
  - [x] Token count display (e.g., "3.4k")
  - [x] Add colocated test file `EventTimelineItem.test.tsx`

- [x] Task 2: Create EventTimeline component (AC: 1)
  - [x] Create `src/renderer/src/features/sessions/components/EventTimeline.tsx`
  - [x] Props: `events: TimelineEvent[]`, `onEventClick: (eventUuid: string) => void`, `activeEventUuid?: string`
  - [x] Render EventTimelineItem for each event
  - [x] Highlight active event (matching current scroll position)
  - [x] Scrollable list with ScrollArea from Radix
  - [x] Empty state: "Events will appear as conversation progresses."
  - [x] Add colocated test file `EventTimeline.test.tsx`

- [x] Task 3: Add TimelineEvent type and mock data (AC: 1)
  - [x] Add to `src/renderer/src/features/sessions/components/types.ts`:
    ```typescript
    interface TimelineEvent {
      uuid: string
      type: 'user' | 'assistant' | 'tool' | 'sub_agent'
      summary: string  // One-line truncated summary
      timestamp: number
      tokenCount?: number  // Optional token count for display
      agentType?: string  // For sub_agent type
      agentId?: string  // For sub_agent type (short ID)
    }
    ```
  - [x] Add `MOCK_TIMELINE_EVENTS` with diverse event types
  - [x] Export types from `index.ts`

- [x] Task 4: Implement scroll-to-event functionality (AC: 1)
  - [x] Add `scrollToEvent(eventUuid: string)` to ConversationView
  - [x] Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` - browser handles timing
  - [x] Add ref tracking for message UUIDs using `useRef<Map<string, HTMLDivElement>>(new Map())`
  - [x] During message rendering, assign refs via callback: `ref={(el) => el && messageRefs.current.set(msg.uuid, el)}`
  - [x] Clear stale refs on sessionId change (alongside expandedTools/expandedSubAgents reset)
  - [x] **NOTE:** EventTimeline integration into RightPanelContent is Story 2c.3 - this task creates the scrollToEvent function and exports it
  - [x] Export scrollToEvent via props or callback for parent component usage
  - [x] Active event highlight tracking deferred to 2c.3 (requires bi-directional integration)

- [x] Task 5: Create ThinkingIndicator component (AC: 2)
  - [x] Create `src/renderer/src/features/sessions/components/ThinkingIndicator.tsx`
  - [x] Animated three-dot indicator (`...` with sequential pulse)
  - [x] Text: "Thinking..."
  - [x] Styling: Left-aligned (assistant position), muted background
  - [x] CSS keyframe animation for dot pulse
  - [x] Add colocated test file `ThinkingIndicator.test.tsx`

- [x] Task 6: Create LoadingIndicator component (AC: 3)
  - [x] Create `src/renderer/src/features/sessions/components/LoadingIndicator.tsx`
  - [x] Text: "Loading Claude Code..."
  - [x] Subtle fade pulse animation on entire component
  - [x] Styling: Left-aligned, muted background
  - [x] Add colocated test file `LoadingIndicator.test.tsx`

- [x] Task 7: Integrate indicators into ConversationView (AC: 2, 3)
  - [x] Import ThinkingIndicator and LoadingIndicator
  - [x] **RENDER** indicators at the END of messages list (after last message, before scroll area ends)
  - [x] Show LoadingIndicator when session state is 'working' and no response yet
  - [x] Transition to ThinkingIndicator when first stream event received
  - [x] Hide indicators when response complete (sessionState === 'idle')
  - [x] **USE** session state from `useUIStore` via `activeTab.sessionState` (NOT useSessionStore)
  - [x] **NOTE:** Get activeTab via props or context - ConversationView receives sessionId, may need sessionState prop added
  - [x] Add local state `isStreaming` to track Loading->Thinking transition
  - [x] **MVP NOTE:** With request-response model, transition logic will be refined in Epic 3b when real streaming is implemented
  - [x] Add tests for indicator state transitions

- [x] Task 8: Update SubAgentBubble running indicator (AC: 4)
  - [x] Update `src/renderer/src/features/sessions/components/SubAgentBubble.tsx`
  - [x] **REPLACE** existing `animate-pulse` on status badge with animated `...` dots
  - [x] Current line 39 has `animate-pulse` on entire badge - change to sequential dot animation
  - [x] Status text "Running..." remains, ADD three dot elements with staggered animation
  - [x] CSS class: `.running-dots` for sequential dot opacity pulse
  - [x] Verify status badge shows "Running" text (already does - line 44)
  - [x] Add/update tests for running animation

- [x] Task 9: Add CSS animations for indicators (AC: 2, 3, 4)
  - [x] Update `src/renderer/src/assets/main.css`
  - [x] Add `@keyframes thinking-dots` animation
  - [x] Add `@keyframes fade-pulse` animation
  - [x] Add `.thinking-indicator` class
  - [x] Add `.loading-indicator` class
  - [x] Add `.running-dots` class for sub-agent

- [x] Task 10: Final validation (AC: all)
  - [x] Run `npm run validate` (tsc + vitest + lint)
  - [x] Verify EventTimeline renders with mock data
  - [x] Verify scroll-to-event works smoothly
  - [x] Verify ThinkingIndicator animation
  - [x] Verify LoadingIndicator animation
  - [x] Verify SubAgentBubble running animation

## Dev Notes

### Previous Story Intelligence (Story 2b.3)

Story 2b.3 established these critical patterns - **MUST FOLLOW**:

**Component Organization:**
- PascalCase files: `SubAgentBubble.tsx`, `ToolCallCard.tsx`, `MessageBubble.tsx`
- Colocate tests: `ComponentName.test.tsx` beside `ComponentName.tsx`
- Feature folder: `src/renderer/src/features/sessions/components/`

**Existing Components to REUSE:**
- `SubAgentBubble.tsx` - Already has Running status badge, needs animated dots addition
- `MessageBubble.tsx` - Reference for message styling and alignment
- `ConversationView.tsx` - Integration target for indicators
- `ToolCallCard.tsx` - Reference for event display patterns

**Existing Utilities to REUSE (DO NOT RECREATE):**
- `src/renderer/src/shared/utils/cn.ts` - Conditional class merging (Tailwind)
- `src/renderer/src/shared/utils/formatTokenCount.ts` - For token count display (e.g., "3.4k")
- `src/renderer/src/shared/utils/formatMessageTimestamp.ts` - For timestamp formatting
- `src/renderer/src/shared/utils/index.ts` - Export barrel

**Existing CSS Classes to REUSE (DO NOT RECREATE):**
- `.collapsible-content` in `main.css` - Radix Collapsible animation (added in Story 2b.2)

**Test Pattern (from 2b.3):**
- Use `@testing-library/react` for component tests
- Use `vi.mock()` to mock stores where needed
- Use fixed timestamps for reproducible tests

**Color System (Dark Theme):**
- Use CSS variables: `var(--bg-elevated)`, `var(--text-primary)`, `var(--text-muted)`, `var(--border)`
- User events: Accent color (`bg-purple-500/20` or similar)
- System events: Elevated background (`var(--bg-elevated)`)
- Sub-agent timeline events: Purple-tinted (`bg-purple-500/10`)

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| Component files | PascalCase.tsx | `EventTimelineItem.tsx`, `ThinkingIndicator.tsx`, `LoadingIndicator.tsx` |
| Tests | Colocated | `.test.tsx` beside source |
| Styling | Tailwind CSS v4 | Utility classes + CSS variables |
| State | Zustand | For scroll position, session state |
| Animations | CSS @keyframes | In main.css |

### UX Design Specifications (CRITICAL)

From `ux-design-specification.md` - Event Timeline:

**Event Timeline Item (User Event):**
```
                    +----------------------+
                    | I need to refactor...| 1.2k
                    +----------------------+
                                      14:32
```
- Alignment: Right
- Background: Accent muted
- Shows truncated summary + token count + timestamp

**Event Timeline Item (System Event):**
```
+----------------------+
| Read routes/index.ts | 3.4k
+----------------------+
14:33
```
- Alignment: Left
- Background: Elevated
- Shows tool/action summary + token count + timestamp

**Sub-Agent Events in Timeline:**
- Display: Agent type + short ID (e.g., "Explore-a8b2")
- Click behavior: Opens sub-agent in dedicated tab (NOT inline scroll)
- Visual: Purple-tinted background (matches sub-agent bubble)

**Thinking Indicator:**
```
+--------------------------------+
| [Claude icon] Thinking...  ... |
+--------------------------------+
```
- Non-persistent (disappears when response arrives)
- Animated dots (sequential pulse)

**Loading Indicator:**
```
+--------------------------------+
| Loading Claude Code...         |
+--------------------------------+
```
- Subtle fade pulse animation
- Transitions to Thinking once connected

### Event Timeline Architecture

From `architecture.md` and `ux-design-specification.md`:

**Timeline Integration with Right Panel:**
- Timeline appears in Events tab of right panel (RightPanelContent)
- Tab structure: [Info] [Events] [Files]
- Events tab renders EventTimeline component

**Scroll Synchronization Pattern:**
```typescript
// In ConversationView - track message refs
const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

// Clear refs when session changes (add to existing sessionId useEffect)
useEffect(() => {
  messageRefs.current.clear()
  setExpandedTools(new Set())
  setExpandedSubAgents(new Set())
}, [sessionId])

// Scroll to event
const scrollToEvent = useCallback((eventUuid: string) => {
  const element = messageRefs.current.get(eventUuid)
  if (element) {
    // Browser handles smooth scroll timing (~300ms)
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}, [])

// In message rendering - assign refs via callback
// Wrap message content in div with ref assignment
<div key={msg.uuid} ref={(el) => el && messageRefs.current.set(msg.uuid, el)}>
  <MessageBubble ... />
</div>

// Track current visible event (intersection observer pattern) - deferred to 2c.3
// Update activeEventUuid based on which message is in view
```

**Event-to-Message Mapping:**
- Each TimelineEvent.uuid corresponds to ConversationMessage.uuid
- Clicking timeline event scrolls conversation to matching message
- Sub-agent events open in tab instead of scrolling (use openSubAgentTab from useUIStore)

### Session State Integration

From `useUIStore.ts` and `useSessionStore.ts`:

**Session State Types (existing):**
```typescript
export type SessionState = 'idle' | 'working' | 'error'
```

**Indicator Display Logic:**
```typescript
// In ConversationView or MiddlePanelContent
const { activeTabId, tabs } = useUIStore()
const activeTab = tabs.find(t => t.id === activeTabId)
const sessionState = activeTab?.sessionState ?? 'idle'

// Show LoadingIndicator when:
// - sessionState === 'working' AND no messages being streamed yet

// Show ThinkingIndicator when:
// - sessionState === 'working' AND streaming has started (first event received)

// Hide all indicators when:
// - sessionState === 'idle' OR response complete
```

**Streaming State (for indicator transitions):**
- Need to track if first stream chunk received
- Can use local state or add to store if needed
- MVP: Local state in ConversationView
- **MVP NOTE:** With request-response model (Epic 3b), actual streaming transitions will be implemented later. For this story, focus on component creation and mock integration. The Loading->Thinking transition can be demonstrated with mock state changes.

### SubAgentBubble Running Animation Update

Current SubAgentBubble (from Story 2b.3) has:
```typescript
status === 'running' && 'text-green-500 bg-green-500/10 animate-pulse'
```

**Update needed:**
- Add animated `...` dots alongside "Running" text
- Pattern: Three dots with sequential opacity animation
- CSS class: `.running-dots` or use Tailwind animation

```typescript
// Updated status display for running
{status === 'running' && (
  <span className="flex items-center">
    Running
    <span className="running-dots ml-1">
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
    </span>
  </span>
)}
```

### CSS Animation Specifications

**Thinking Dots Animation:**
```css
@keyframes thinking-dots {
  0%, 20% { opacity: 0.3; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0.3; }
}

.thinking-indicator .dot:nth-child(1) { animation: thinking-dots 1.4s ease-in-out infinite; }
.thinking-indicator .dot:nth-child(2) { animation: thinking-dots 1.4s ease-in-out 0.2s infinite; }
.thinking-indicator .dot:nth-child(3) { animation: thinking-dots 1.4s ease-in-out 0.4s infinite; }
```

**Fade Pulse Animation:**
```css
@keyframes fade-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.loading-indicator {
  animation: fade-pulse 2s ease-in-out infinite;
}
```

**Running Dots Animation:**
```css
.running-dots .dot:nth-child(1) { animation: thinking-dots 1.4s ease-in-out infinite; }
.running-dots .dot:nth-child(2) { animation: thinking-dots 1.4s ease-in-out 0.2s infinite; }
.running-dots .dot:nth-child(3) { animation: thinking-dots 1.4s ease-in-out 0.4s infinite; }
```

### Mock Data for Testing

```typescript
// Add to types.ts
// NOTE: Fixed timestamps (1737640000000 = 2026-01-23T11:06:40Z) ensure reproducible tests
// For runtime development mocks, consider createMockTimelineEvents() pattern like createMockMessages()
export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    uuid: 'evt-001',
    type: 'user',
    summary: 'Can you analyze the authentication code?',
    timestamp: 1737640000000, // 2026-01-23T11:06:40Z
    tokenCount: 1200
  },
  {
    uuid: 'evt-002',
    type: 'assistant',
    summary: "I'll examine the auth module thoroughly...",
    timestamp: 1737640060000,
    tokenCount: 3400
  },
  {
    uuid: 'evt-003',
    type: 'tool',
    summary: 'Read src/auth/login.ts',
    timestamp: 1737640120000,
    tokenCount: 850
  },
  {
    uuid: 'evt-004',
    type: 'sub_agent',
    summary: 'Explore-a8b2',
    timestamp: 1737640180000,
    tokenCount: 5200,
    agentType: 'Explore',
    agentId: 'a8b2'
  },
  {
    uuid: 'evt-005',
    type: 'assistant',
    summary: 'Based on my analysis, there are 3 issues...',
    timestamp: 1737640360000,
    tokenCount: 2100
  }
]
```

### File Structure

**New Files:**
- `src/renderer/src/features/sessions/components/EventTimelineItem.tsx`
- `src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx`
- `src/renderer/src/features/sessions/components/EventTimeline.tsx`
- `src/renderer/src/features/sessions/components/EventTimeline.test.tsx`
- `src/renderer/src/features/sessions/components/ThinkingIndicator.tsx`
- `src/renderer/src/features/sessions/components/ThinkingIndicator.test.tsx`
- `src/renderer/src/features/sessions/components/LoadingIndicator.tsx`
- `src/renderer/src/features/sessions/components/LoadingIndicator.test.tsx`

**Modified Files:**
- `src/renderer/src/features/sessions/components/types.ts` - Add TimelineEvent type
- `src/renderer/src/features/sessions/components/index.ts` - Export new components
- `src/renderer/src/features/sessions/components/ConversationView.tsx` - Add indicators, scroll-to-event
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx` - Add indicator tests
- `src/renderer/src/features/sessions/components/SubAgentBubble.tsx` - Add running dots animation
- `src/renderer/src/features/sessions/components/SubAgentBubble.test.tsx` - Update running tests
- `src/renderer/src/assets/main.css` - Add CSS animations

### Scope Boundaries

**In Scope:**
- EventTimelineItem component
- EventTimeline component with event list
- Scroll-to-event functionality (click timeline item -> scroll conversation)
- ThinkingIndicator component with animated dots
- LoadingIndicator component with fade pulse
- Integration into ConversationView
- SubAgentBubble running dots animation
- CSS keyframe animations

**Out of Scope (Future Stories):**
- RightPanelContent Events tab integration (Story 2c.3)
- Real-time timeline updates from streaming (Epic 3b)
- Bi-directional scroll sync (timeline highlighting based on scroll position) - MVP is one-way (click timeline -> scroll conversation)
- Token count calculation from real messages (uses mock/provided data)

### Dependencies

**Already Installed (verified):**
- `@radix-ui/react-scroll-area` - For scrollable timeline (already used in ConversationView.tsx)
- `lucide-react` - For icons (already used in SubAgentBubble.tsx, ToolCallCard.tsx)
- Tailwind CSS v4 - Styling
- `vitest` + `@testing-library/react` - Testing
- `zustand` - State management

**Existing Utilities (REUSE):**
- `cn` - `src/renderer/src/shared/utils/cn.ts`
- `formatTokenCount` - `src/renderer/src/shared/utils/formatTokenCount.ts`
- `formatMessageTimestamp` - `src/renderer/src/shared/utils/formatMessageTimestamp.ts`

### Barrel File Updates

**Update `src/renderer/src/features/sessions/components/index.ts`:**
```typescript
// ... existing exports ...
// Story 2b.4: Navigation and Loading States
export { EventTimelineItem } from './EventTimelineItem'
export { EventTimeline } from './EventTimeline'
export { ThinkingIndicator } from './ThinkingIndicator'
export { LoadingIndicator } from './LoadingIndicator'
export type { TimelineEvent } from './types'
export { MOCK_TIMELINE_EVENTS } from './types'
```

### Testing Strategy

**EventTimelineItem Tests:**
- Renders user event right-aligned with accent background
- Renders system event left-aligned with elevated background
- Renders tool event with tool icon
- Renders sub-agent event with purple tint
- Shows truncated summary
- Shows formatted token count
- Shows timestamp
- Calls onClick when clicked

**EventTimeline Tests:**
- Renders list of EventTimelineItems
- Highlights active event
- Scrollable with many events
- Shows empty state when no events
- Calls onEventClick with correct uuid
- Sub-agent events call openSubAgentTab instead of onEventClick

**ThinkingIndicator Tests:**
- Renders "Thinking..." text
- Has three animated dots
- Has correct CSS animation classes
- Is visually left-aligned

**LoadingIndicator Tests:**
- Renders "Loading Claude Code..." text
- Has fade-pulse animation class
- Is visually left-aligned

**ConversationView Indicator Integration Tests:**
- Shows LoadingIndicator when working and no messages streaming
- Shows ThinkingIndicator when working and streaming started
- Hides indicators when response complete
- Transitions from Loading to Thinking correctly

**SubAgentBubble Running Animation Tests:**
- Running status shows animated dots
- Dots have sequential animation delay
- Animation plays when status is 'running'
- No animation when status is 'done' or 'error'

### Performance Considerations

- NFR3: Sub-agent expansion < 100ms (client-side only)
- Scroll animation: 300ms ease-out (smooth but responsive)
- CSS animations: GPU-accelerated (opacity, transform)
- EventTimeline: Use virtualization if > 100 events (future optimization)

### References

- [Source: epics.md#Epic 2b Story 2b.4] - Acceptance criteria and FR40, FR41, FR42 mapping
- [Source: ux-design-specification.md#Event Timeline Item] - Visual specifications
- [Source: ux-design-specification.md#Thinking Indicator] - Indicator specifications
- [Source: architecture.md#Conversation Rendering] - Event structure
- [Source: project-context.md#Loading States] - Session state patterns
- [Source: 2b-3-sub-agent-display.md#Dev Notes] - Previous story patterns

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- All new components in `src/renderer/src/features/sessions/components/`
- CSS animations in `src/renderer/src/assets/main.css`
- No conflicts detected with existing structure

## Story Quality Review

### Review Date
2026-01-23 (Second Review Pass)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Create-Story Workflow (AUTONOMOUS MODE)

### Review Outcome
**APPROVED** - Story is implementation-ready with accurate codebase alignment after second review pass.

### Second Review Pass - Issues Found and Fixed

#### CRITICAL Issues: 0

#### HIGH Issues: 0
No new high issues found in second review.

#### MEDIUM Issues (2 - fixed)

**M1: Task 4 scroll-to-event implementation details incomplete**
- Problem: Original Task 4 didn't specify ref assignment during rendering or ref cleanup
- Fix: Added explicit ref callback pattern `ref={(el) => el && messageRefs.current.set(msg.uuid, el)}`
- Fix: Added ref cleanup on sessionId change alongside existing reset logic
- Fix: Clarified browser handles smooth scroll timing (~300ms) - no custom timing needed

**M2: Task 7 indicator rendering location and MVP scope unclear**
- Problem: Didn't specify WHERE indicators render (at END of messages list)
- Problem: Streaming transition logic may not be observable in request-response MVP
- Fix: Added "RENDER indicators at END of messages list"
- Fix: Added MVP NOTE about request-response model - transition logic refined in Epic 3b

#### LOW Issues (2 - fixed)

**L1: Mock timeline event timestamps need context**
- Problem: Fixed timestamps without noting they're January 2026 values
- Fix: Added comment `// NOTE: Fixed timestamps (1737640000000 = 2026-01-23T11:06:40Z) ensure reproducible tests`

**L2: Dependencies already in use not noted**
- Problem: @radix-ui/react-scroll-area and lucide-react listed without noting they're already imported in existing components
- Fix: Added parenthetical notes showing where already used

### First Review Pass - Issues Fixed (preserved for reference)

#### HIGH Issues (1 total - fixed in first pass)

**H1: SubAgentBubble animate-pulse needs replacement, not addition**
- Problem: Story said "Add animated `...` dots" but SubAgentBubble line 39 already has `animate-pulse` on entire badge
- Fix: Updated Task 8 to explicitly state "REPLACE existing `animate-pulse`" and reference specific line numbers
- The AC specifies "animated `...` indicator" which requires sequential dot animation, not whole-element pulse

#### MEDIUM Issues (2 total - fixed in first pass)

**M1: Session state integration path unclear**
- Problem: Task 7 said "Use session state from useSessionStore or useUIStore" without specifying which
- Fix: Updated Task 7 to explicitly state "USE session state from `useUIStore` via `activeTab.sessionState`"
- Verified: Tab interface in useUIStore has `sessionState: SessionState` field

**M2: EventTimeline right panel integration scope unclear**
- Problem: Task 4 mentioned wiring up EventTimeline.onEventClick but didn't clarify integration boundary
- Fix: Updated Task 4 to note that RightPanelContent integration is Story 2c.3
- This story creates the components and scroll function; 2c.3 integrates into right panel

### Acceptance Criteria Verification
- AC1 (Event Timeline navigation): COMPLETE - EventTimeline/EventTimelineItem components, scroll-to-event, types
- AC2 (Thinking indicator): COMPLETE - ThinkingIndicator component with animated dots
- AC3 (Loading indicator): COMPLETE - LoadingIndicator component with fade pulse
- AC4 (Sub-agent running animation): COMPLETE - SubAgentBubble update with sequential dot animation

### Technical Alignment Verification
- useUIStore Tab interface: VERIFIED - has `sessionState: SessionState` (idle/working/error)
- SubAgentBubble current state: VERIFIED - line 39 has animate-pulse, line 44 has "Running..." text
- ConversationView structure: VERIFIED - uses ScrollArea, can add messageRefs Map
- CSS animations location: VERIFIED - main.css has existing keyframes (slideDown, slideUp, tab-pulse)
- Test pattern: VERIFIED - follows @testing-library/react pattern from 2b.3

### Recommendation
Story is complete and ready for dev-story execution.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

1. **Task 3 Completed**: Added TimelineEvent type interface and MOCK_TIMELINE_EVENTS with 5 diverse events (user, assistant, tool, sub_agent) to types.ts. Also added createMockTimelineEvents() for runtime mocks.

2. **Task 1 Completed**: Created EventTimelineItem component with proper alignment (user events right-aligned with purple background, system events left-aligned with elevated background). Uses formatTokenCount and formatMessageTimestamp utilities. Includes icon display (User, Bot, Wrench) based on event type.

3. **Task 2 Completed**: Created EventTimeline component using Radix ScrollArea. Handles event clicks with special routing for sub-agent events (calls onSubAgentClick instead of onEventClick). Shows empty state when no events.

4. **Task 5 Completed**: Created ThinkingIndicator component with "Thinking" text and three animated dots. Accessible with role="status" and aria-label.

5. **Task 6 Completed**: Created LoadingIndicator component with "Loading Claude Code..." text. Uses .loading-indicator class for fade-pulse animation.

6. **Task 9 Completed**: Added CSS keyframe animations to main.css:
   - @keyframes thinking-dots (sequential opacity pulse)
   - @keyframes fade-pulse (fade in/out)
   - .thinking-indicator .dot:nth-child(n) selectors with staggered delays
   - .loading-indicator with fade-pulse animation
   - .running-dots for SubAgentBubble running state

7. **Task 8 Completed**: Updated SubAgentBubble to replace animate-pulse with animated dots. Status badge now shows "Running" with three dots that have sequential animation. Removed animate-pulse class, added .running-dots container with .dot elements.

8. **Task 4 Completed**: Added scroll-to-event functionality to ConversationView:
   - Added messageRefs Map to track message element references
   - Wrapped message content in divs with ref callbacks
   - Created scrollToEvent function using scrollIntoView
   - Exposed via onScrollToEventRef callback prop
   - Clear refs on sessionId change

9. **Task 7 Completed**: Integrated LoadingIndicator and ThinkingIndicator into ConversationView:
   - Added sessionState prop (defaults to 'idle')
   - Added isStreaming local state for Loading->Thinking transition
   - Indicators render at END of messages list
   - LoadingIndicator shows when working && !isStreaming
   - ThinkingIndicator shows when working && isStreaming
   - isStreaming set true when messages arrive during 'working' state

10. **Task 10 Completed**: All validations pass:
    - `npm run validate` passes (tsc, vitest with 516 tests, eslint)
    - All new components have comprehensive tests
    - ConversationView tests include indicator state transition tests

### Change Log

**2026-01-23**: Story 2b.4 implementation complete
- Added TimelineEvent type and MOCK_TIMELINE_EVENTS to types.ts
- Created EventTimelineItem component with tests (16 tests)
- Created EventTimeline component with tests (13 tests)
- Created ThinkingIndicator component with tests (12 tests)
- Created LoadingIndicator component with tests (11 tests)
- Added CSS animations (thinking-dots, fade-pulse, running-dots) to main.css
- Updated SubAgentBubble with animated running dots (replaced animate-pulse)
- Updated SubAgentBubble tests (27 tests pass)
- Updated ConversationView with scroll-to-event and indicator integration
- Added 8 new tests to ConversationView for indicators and scroll functionality
- Updated index.ts barrel exports for new components
- All 516 tests pass, TypeScript compiles, ESLint clean

**2026-01-23 Code Review (Review 1) - Issues Fixed:**
- H1: MiddlePanelContent.tsx was not passing sessionState to ConversationView - FIXED
- M1: EventTimelineItem sub-agent icon now uses Users instead of Bot for visual distinction - FIXED
- M3: ConversationView cleanup test improved with actual assertion - FIXED
- Added 2 new tests for sessionState prop in MiddlePanelContent.test.tsx
- All 518 tests pass

**2026-01-23 Code Review (Review 2) - APPROVED:**
- Performed thorough adversarial review of all 10 implementation files and 8 test files
- Verified all 4 Acceptance Criteria properly implemented
- Verified all 10 Tasks marked [x] are actually complete
- Verified CSS animations (thinking-dots, fade-pulse, running-dots) correctly implemented
- Verified barrel exports in index.ts are complete
- Verified MiddlePanelContent properly passes sessionState prop
- All 518 tests pass, TypeScript compiles, ESLint clean
- ZERO ISSUES FOUND - Story marked as done

### File List

**New Files:**
- src/renderer/src/features/sessions/components/EventTimelineItem.tsx
- src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx
- src/renderer/src/features/sessions/components/EventTimeline.tsx
- src/renderer/src/features/sessions/components/EventTimeline.test.tsx
- src/renderer/src/features/sessions/components/ThinkingIndicator.tsx
- src/renderer/src/features/sessions/components/ThinkingIndicator.test.tsx
- src/renderer/src/features/sessions/components/LoadingIndicator.tsx
- src/renderer/src/features/sessions/components/LoadingIndicator.test.tsx

**Modified Files:**
- src/renderer/src/features/sessions/components/types.ts (added TimelineEvent, MOCK_TIMELINE_EVENTS, createMockTimelineEvents)
- src/renderer/src/features/sessions/components/index.ts (added exports for new components)
- src/renderer/src/features/sessions/components/ConversationView.tsx (added indicators, scroll-to-event, sessionState prop)
- src/renderer/src/features/sessions/components/ConversationView.test.tsx (added indicator and scroll tests, improved cleanup test)
- src/renderer/src/features/sessions/components/SubAgentBubble.tsx (replaced animate-pulse with animated dots)
- src/renderer/src/features/sessions/components/SubAgentBubble.test.tsx (updated running animation tests)
- src/renderer/src/assets/main.css (added thinking-dots, fade-pulse, running-dots animations)
- src/renderer/src/core/shell/MiddlePanelContent.tsx (added sessionState prop to ConversationView - Review Fix)
- src/renderer/src/core/shell/MiddlePanelContent.test.tsx (added sessionState tests - Review Fix)
