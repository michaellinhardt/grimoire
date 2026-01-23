# Discovery Document: Story 2b.6 - Sub-Agent Tab Read-Only

## Story Requirements (from Epics)

### User Story Statement

**As a** user viewing a sub-agent conversation,
**I want** a read-only view without chat input,
**So that** I understand this is a historical view, not an interactive session.

### Acceptance Criteria

1. **Given** a sub-agent conversation is opened in a tab (FR67i)
   **When** the tab type is `subagent`
   **Then** the chat input area at the bottom is hidden completely
   **And** the conversation view expands to fill the available space

2. **Given** a main session tab is active
   **When** switching between main session and sub-agent tabs
   **Then** the input area appears/disappears appropriately based on tab type

### Technical Requirements

- FR67i: System hides chat input when viewing sub-agent conversation tab
- Tab type `subagent` is already defined in `useUIStore.ts`
- Sub-agent tabs already have visual differentiation via `.tab--subagent` CSS class

---

## Previous Story Learnings (Epic 2b Context)

### Files Created/Modified in Epic 2b

Based on current codebase analysis:

| File | Purpose |
|------|---------|
| `src/renderer/src/features/sessions/components/MessageBubble.tsx` | User/Claude message rendering |
| `src/renderer/src/features/sessions/components/ToolCallCard.tsx` | Tool call display |
| `src/renderer/src/features/sessions/components/SubAgentBubble.tsx` | Sub-agent display with expand/collapse |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Main conversation container with scroll, rewind |
| `src/renderer/src/features/sessions/components/ThinkingIndicator.tsx` | "Thinking" animation |
| `src/renderer/src/features/sessions/components/LoadingIndicator.tsx` | "Loading CC" indicator |
| `src/renderer/src/features/sessions/components/EventTimeline.tsx` | Navigation timeline |
| `src/renderer/src/features/sessions/components/RewindModal.tsx` | Rewind dialog (Story 2b.5) |
| `src/renderer/src/shared/store/useUIStore.ts` | Tab management, openSubAgentTab function |
| `src/renderer/src/core/shell/TabBar.tsx` | Tab rendering with `.tab--subagent` class |

### Patterns Established

1. **Tab Type Handling**: Tab interface includes `type: 'session' | 'subagent' | 'file'`
2. **Sub-Agent Tab Creation**: `openSubAgentTab(subAgent)` in useUIStore creates tabs with:
   - `id: subagent-${subAgent.id}`
   - `type: 'subagent'`
   - `title: ${agentType}-${shortId}` (e.g., "Explore-a8b2")
   - `sessionId: subAgent.id`
3. **Tab Visual Differentiation**: CSS class `.tab--subagent` applied in TabBar.tsx line 106
4. **ConversationView Props**: Already accepts `sessionState` for indicators; needs tab type awareness

### Dev Notes from Previous Stories

- Rewind modal state resets on session switch (Story 2b.5 pattern)
- Scroll positions are persisted per session via `scrollPositions` Map in useUIStore
- Session state indicators already conditionally render based on `sessionState`

---

## Architecture Relevance

### Applicable Patterns

1. **Conditional Rendering Based on Tab Type**
   - Tab type is available from `useUIStore().tabs` and `activeTabId`
   - Pattern: `const activeTab = tabs.find(t => t.id === activeTabId)`
   - Check: `activeTab?.type === 'subagent'`

2. **Component Architecture**
   - Chat input is likely a sibling to ConversationView in the layout
   - Need to identify where chat input is rendered (likely in Shell or MiddlePanel)
   - Conditional render: `{activeTab?.type !== 'subagent' && <ChatInput />}`

3. **Tab Type Conventions (from Architecture)**
   | Type     | Value        | Visual Treatment                        | Chat Input |
   |----------|-------------|----------------------------------------|------------|
   | Session  | `'session'`  | Default tab styling                     | Shown      |
   | SubAgent | `'subagent'` | `.tab--subagent` CSS class (color tint) | Hidden     |

### Constraints for This Story

1. **No Changes to Sub-Agent Loading Logic**: Only UI conditional rendering
2. **Preserve Scroll Position**: ConversationView scroll persistence should work for sub-agents too
3. **Respect Existing Indicators**: Loading/Thinking indicators not applicable for historical sub-agent views (sessionState is 'idle' or 'done')
4. **CSS Variable Usage**: Use existing CSS variables (--bg-base, --text-primary, etc.)

### Files Likely to Modify

1. **Layout Component** (likely `src/renderer/src/core/shell/MiddlePanel.tsx` or Shell.tsx)
   - Wrap chat input in conditional based on active tab type

2. **ConversationView.tsx** (optional)
   - May need to adjust layout if chat input is inside ConversationView
   - Currently has loading indicators at bottom; may need adjustment for read-only mode

3. **ChatInput or ChatInputPlaceholder**
   - Located at `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
   - This is the component to conditionally hide

### Integration Points

```
User clicks "Open in Tab" on SubAgentBubble
       |
       v
openSubAgentTab(subAgent) in useUIStore
       |
       v
New tab created with type: 'subagent'
       |
       v
Layout component reads activeTabId and checks type
       |
       v
if type === 'subagent': Hide ChatInput, ConversationView fills space
```

---

## Git Context

### Recent Relevant Commits

| Commit | Message |
|--------|---------|
| f11f74d | checkpoint, work on sprint-runner |
| b8beb05 | checkpoint, work on sprint-runner |
| 5aea833 | checkpoint, 33% completion |
| 89c0cf7 | feat: session scanner and database sync (story 2a-1) |

### Key Implementation Context

- Epic 2b stories (2b-1 through 2b-5) appear to have been implemented
- Sprint status shows 2b-6 as `backlog` - this is the last story in Epic 2b
- Recent work focused on sprint automation tooling

---

## Implementation Guidance

### Recommended Approach

1. **Locate Chat Input Rendering**: Find where `ChatInputPlaceholder` or similar is rendered in the layout
2. **Add Tab Type Check**: Use `activeTab?.type !== 'subagent'` conditional
3. **Adjust CSS for Full Height**: Ensure ConversationView fills space when input hidden

### Code Pattern Example

```typescript
// In layout component
const { tabs, activeTabId } = useUIStore()
const activeTab = tabs.find(t => t.id === activeTabId)
const isSubAgentTab = activeTab?.type === 'subagent'

return (
  <div className="flex flex-col h-full">
    <ConversationView {...props} />
    {!isSubAgentTab && <ChatInputPlaceholder />}
  </div>
)
```

### Test Scenarios

1. Open main session tab - verify chat input is visible
2. Open sub-agent tab via SubAgentBubble [->] button - verify chat input is hidden
3. Switch between main session and sub-agent tabs - verify input appears/disappears
4. Verify ConversationView expands to fill space when input hidden

---

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2b.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tab-Type-Conventions]
- [Source: src/renderer/src/shared/store/useUIStore.ts#openSubAgentTab]
- [Source: src/renderer/src/core/shell/TabBar.tsx#line-106]
