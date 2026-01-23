# Story 2b.2: Tool Call Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see tool calls as distinct visual elements**,
so that **I can understand what actions Claude performed and inspect their details**.

## Acceptance Criteria

1. **Given** a conversation contains tool calls (FR34) **When** rendered in the conversation **Then** tool calls appear as compact cards with tool-specific background (blue-tinted) **And** tool cards have blue left border and monospace font **And** tool cards are visually distinct from regular message bubbles

2. **Given** a tool call is displayed (collapsed by default) **When** the user views it **Then** it shows: tool name + brief summary (e.g., "Read src/api/routes/index.ts") **And** a chevron indicates expandable state

3. **Given** the user clicks a collapsed tool call (FR35) **When** it expands **Then** full input parameters are displayed **And** full output/result is displayed **And** clicking again collapses it back

4. **Given** a tool call failed (FR38) **When** displayed in the conversation **Then** a red left border and error background tint indicate failure **And** error message is visible in collapsed state **And** expanding shows full error details

## Tasks / Subtasks

- [x] Task 1: Create ToolCallCard component with collapsed state (AC: 1, 2)
  - [x] Create `src/renderer/src/features/sessions/components/ToolCallCard.tsx`
  - [x] Props: `toolCall: ToolUseBlock`, `result: ToolResultBlock | null`, `isExpanded?: boolean`, `onToggle?: () => void`
  - [x] Collapsed state: tool name + summary on single line + chevron icon
  - [x] Styling: Blue-tinted background (`bg-blue-500/10`), blue left border (`border-l-2 border-blue-500`)
  - [x] Monospace font for tool name and file paths (`font-mono`)
  - [x] **REQUIRED:** Use `cn()` utility from `src/renderer/src/shared/utils/cn.ts`
  - [x] **REQUIRED:** Use `ChevronRight` from `lucide-react` for chevron icon (rotates to ChevronDown on expand)
  - [x] Add JSDoc with @param and @returns documentation
  - [x] Add colocated test file `ToolCallCard.test.tsx`

- [x] Task 2: Implement tool call summary generation (AC: 2)
  - [x] Create `src/renderer/src/shared/utils/formatToolSummary.ts`
  - [x] Generate brief summary based on tool name and input:
    - Read: `"Read {file_path}"` (e.g., "Read src/api/routes/index.ts")
    - Write: `"Write {file_path}"` (e.g., "Write src/utils/helper.ts")
    - Edit: `"Edit {file_path}"` (e.g., "Edit src/main/index.ts")
    - NotebookEdit: `"NotebookEdit {notebook_path}"` (e.g., "NotebookEdit analysis.ipynb")
    - Bash: First 50 chars of command + "..." if truncated
    - Glob: `"Glob {pattern}"` (e.g., "Glob **/*.tsx")
    - Grep: `"Grep {pattern}"` (e.g., "Grep TODO")
    - WebSearch: `"Search {query}"` (e.g., "Search React best practices")
    - WebFetch: `"Fetch {url}"` (e.g., "Fetch https://docs.example.com")
    - Task: `"{subagent_type} agent"` (e.g., "Explore agent") - handled separately in Story 2b.3
    - Default: `"{tool_name}"` for unknown tools
  - [x] Truncate long file paths: show last 40 chars with "..." prefix if needed
  - [x] Add colocated tests `formatToolSummary.test.ts`
  - [x] Export from `src/renderer/src/shared/utils/index.ts`

- [x] Task 3: Implement expanded state with input/output display (AC: 3)
  - [x] Install `@radix-ui/react-collapsible`: `npm install @radix-ui/react-collapsible`
  - [x] Add expanded state rendering to ToolCallCard
  - [x] Show tool input parameters in collapsible section (JSON format, use `<pre>` with `font-mono`)
  - [x] Show tool result/output in collapsible section
  - [x] Use Radix Collapsible for smooth expand/collapse animation
  - [x] Chevron icon rotates on expand using `cn()` with `rotate-90` class transition
  - [x] Truncate very long outputs with "Show more" option (> 500 chars collapsed, full on expand)
  - [x] **NOTE:** For accessibility, use Radix Collapsible.Trigger with `asChild` to wrap a native button element
  - [x] Add tests for expanded state rendering

- [x] Task 4: Implement error state display (AC: 4)
  - [x] Detect error using `result.is_error === true` first (explicit indicator from Claude Code API)
  - [x] Fallback: detect from `result.content` containing error indicators (error:, failed, not found, etc.)
  - [x] Error styling: Red left border (`border-l-2 border-red-500`), red-tinted background (`bg-red-500/10`)
  - [x] Show error message preview in collapsed state (first 100 chars)
  - [x] Full error details visible when expanded
  - [x] Add tests for error state (both explicit is_error and string-based detection)

- [x] Task 5: Add TypeScript types for tool call/result blocks (AC: all)
  - [x] Add types to `src/renderer/src/features/sessions/components/types.ts`:
    ```typescript
    interface ToolUseBlock {
      type: 'tool_use'
      id: string
      name: string
      input: Record<string, unknown>
    }

    interface ToolResultBlock {
      type: 'tool_result'
      tool_use_id: string
      content: string
      is_error?: boolean  // Explicit error indicator from Claude Code API
    }

    interface ToolPair {
      call: ToolUseBlock
      result: ToolResultBlock | null
    }
    ```
  - [x] Extend `ConversationMessage` interface to support tool blocks:
    ```typescript
    interface ConversationMessage {
      uuid: string
      role: 'user' | 'assistant'
      content: string
      timestamp: number
      // NEW: Optional tool data for assistant messages
      toolUseBlocks?: ToolUseBlock[]
      toolResults?: ToolResultBlock[]
    }
    ```
  - [x] Add mock tool data for testing (MOCK_TOOL_CALLS, MOCK_TOOL_RESULTS, MOCK_ERROR_RESULT)
  - [x] Create mock messages with tool blocks: `MOCK_MESSAGES_WITH_TOOLS`
  - [x] Export types from `src/renderer/src/features/sessions/components/index.ts`

- [x] Task 6: Create utility to pair tool calls with results (AC: 3)
  - [x] Create `src/renderer/src/shared/utils/pairToolCalls.ts`
  - [x] **For MVP (mock data):** Create simplified function `findToolResult(toolId: string, results: ToolResultBlock[]): ToolResultBlock | null`
  - [x] **For Epic 3b (real data):** Full `pairToolCallsWithResults(messages: ConversationMessage[]): Map<string, ToolPair>`
  - [x] Match `tool_use` blocks to `tool_result` blocks via `id` / `tool_use_id`
  - [x] Handle missing results (tool call without result = pending or error)
  - [x] Add colocated tests
  - [x] Export from utils index
  - [x] **NOTE:** For this story, ConversationMessage already contains `toolResults` array, so simple `find()` works. Full event stream parsing is deferred to Epic 3b.

- [x] Task 7: Integrate ToolCallCard into ConversationView (AC: all)
  - [x] Update `src/renderer/src/features/sessions/components/ConversationView.tsx`
  - [x] Import and render ToolCallCard for `tool_use` content blocks
  - [x] Pass paired result from pairToolCallsWithResults
  - [x] Manage expansion state locally (controlled component pattern)
  - [x] Skip rendering `tool_result` events separately (they are paired with calls)
  - [x] Update ConversationView tests

- [x] Task 8: Final validation (AC: all)
  - [x] Run `npm run validate` (tsc + vitest + lint)
  - [x] Verify tool cards render with blue-tinted styling
  - [x] Verify collapse/expand works correctly
  - [x] Verify error state displays red styling
  - [x] Verify tool summaries generate correctly

## Dev Notes

### Previous Story Intelligence (Story 2b.1)

Story 2b.1 established these critical patterns - **MUST FOLLOW**:

**Component Organization:**
- PascalCase files: `MessageBubble.tsx`, `ConversationView.tsx`
- Colocate tests: `MessageBubble.test.tsx` beside `MessageBubble.tsx`
- Feature folder: `src/renderer/src/features/sessions/components/`

**Existing Components to REUSE:**
- `MessageBubble.tsx` - For reference on styling patterns and CSS variable usage
- `ConversationView.tsx` - Integration target, already handles message rendering
- `types.ts` - Contains `ConversationMessage`, extend with tool types

**Existing Utilities to REUSE (DO NOT RECREATE):**
- `src/renderer/src/shared/utils/cn.ts` - Conditional class merging (Tailwind)
- `src/renderer/src/shared/utils/formatRelativeTime.ts` - Time formatting
- `src/renderer/src/shared/utils/index.ts` - Export barrel

**Test Pattern (from 2b.1):**
- Use `@testing-library/react` for component tests
- Use `vi.useFakeTimers()` with `vi.setSystemTime()` for time-dependent tests
- Mock `window.grimoireAPI` if needed

**Color System (Dark Theme):**
- Use CSS variables: `var(--bg-elevated)`, `var(--text-primary)`, `var(--border)`
- Blue accent for tools: `bg-blue-500/10`, `border-blue-500`
- Red accent for errors: `bg-red-500/10`, `border-red-500`

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| Component files | PascalCase.tsx | `ToolCallCard.tsx` |
| Tests | Colocated | `ToolCallCard.test.tsx` beside source |
| Styling | Tailwind CSS v4 | Utility classes + CSS variables |
| Expand/Collapse | Radix Collapsible | `@radix-ui/react-collapsible` |
| Types | Shared types file | Add to `types.ts` |

### UX Design Specifications (CRITICAL)

From `ux-design-specification.md` - Tool Bubble Components:

**Tool Bubble (Collapsed):**
```
+----------------------------------+
| Read  src/api/routes/index.ts  > |
+----------------------------------+
14:33
```
- Alignment: Left
- Background: Tool background (blue-tinted)
- Border: Blue left border
- Font: Monospace for tool name and paths
- Chevron: Indicates expandable state

**Tool Bubble (Expanded):**
```
+----------------------------------+
| Read  src/api/routes/index.ts  v |
+----------------------------------+
| Input:                           |
| { "file_path": "src/api/..." }   |
+----------------------------------+
| Output:                          |
| export function handler() { ... }|
+----------------------------------+
14:33
```

**Error Tool State:**
```
+----------------------------------+
| Read  missing-file.ts  ERROR   > |
+----------------------------------+
```
- Border: Red left border (replaces blue)
- Background: Red-tinted (`bg-red-500/10`)
- Error message visible in collapsed state

### Tool Types from Architecture

From `architecture.md` - Content Block Types:

```typescript
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

interface ToolUseBlock {
  type: 'tool_use'
  id: string  // e.g., "toolu_01HXYyux..."
  name: string  // e.g., "Read", "Write", "Edit", "Task", "Bash", "Glob", "Grep"
  input: Record<string, unknown>  // Tool-specific parameters
}

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string  // Matches ToolUseBlock.id
  content: string  // Result text or error message
}
```

**Common Tool Input Patterns:**
| Tool | Key Input Fields |
|------|-----------------|
| Read | `file_path: string` |
| Write | `file_path: string`, `content: string` |
| Edit | `file_path: string`, `old_string: string`, `new_string: string` |
| Bash | `command: string` |
| Glob | `pattern: string`, `path?: string` |
| Grep | `pattern: string`, `path?: string` |
| Task | `description: string`, `subagent_type: string`, `prompt: string` |

### Tool Call/Result Pairing Logic

From `architecture.md`:

```typescript
function pairToolCallsWithResults(events: ConversationEvent[]): Map<string, ToolPair> {
  const pairs = new Map<string, ToolPair>()

  for (const event of events) {
    // Find tool_use in assistant messages
    if (event.type === 'assistant') {
      for (const content of event.message.content) {
        if (content.type === 'tool_use') {
          pairs.set(content.id, { call: content, result: null })
        }
      }
    }

    // Find tool_result in user messages
    if (event.type === 'user' && Array.isArray(event.message.content)) {
      for (const content of event.message.content) {
        if (content.type === 'tool_result' && pairs.has(content.tool_use_id)) {
          pairs.get(content.tool_use_id)!.result = content
        }
      }
    }
  }

  return pairs
}
```

### Color System for Tool Cards

| State | Background | Border | Text |
|-------|------------|--------|------|
| Normal | `bg-blue-500/10` | `border-l-2 border-blue-500` | `text-[var(--text-primary)]` |
| Error | `bg-red-500/10` | `border-l-2 border-red-500` | `text-red-400` for error text |
| Hover | `bg-blue-500/15` | Same | Same |

### Radix Collapsible Usage

**MUST INSTALL FIRST (not in project):**
```bash
npm install @radix-ui/react-collapsible
```

```typescript
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatToolSummary } from '@renderer/shared/utils/formatToolSummary'

function ToolCallCard({ toolCall, result, isExpanded, onToggle }: ToolCallCardProps) {
  return (
    <Collapsible.Root open={isExpanded} onOpenChange={onToggle}>
      <Collapsible.Trigger asChild>
        <button className="w-full text-left flex items-center justify-between p-3 ...">
          <span className="font-mono">{toolCall.name}</span>
          <span className="truncate flex-1 mx-2">{formatToolSummary(toolCall)}</span>
          <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
        <div className="p-3 border-t border-[var(--border)]">
          {/* Input section */}
          <div className="text-xs text-[var(--text-muted)] mb-1">Input:</div>
          <pre className="text-xs font-mono bg-[var(--bg-base)] p-2 rounded overflow-x-auto">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>

          {/* Output section */}
          {result && (
            <>
              <div className="text-xs text-[var(--text-muted)] mt-3 mb-1">Output:</div>
              <pre className="text-xs font-mono bg-[var(--bg-base)] p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                {result.content}
              </pre>
            </>
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
```

### formatToolSummary Implementation

```typescript
// src/renderer/src/shared/utils/formatToolSummary.ts

import type { ToolUseBlock } from '@renderer/features/sessions/components/types'

/**
 * Generate a brief summary for a tool call
 * @param toolCall - The tool use block to summarize
 * @returns A brief human-readable summary
 */
export function formatToolSummary(toolCall: ToolUseBlock): string {
  const { name, input } = toolCall

  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const filePath = (input.file_path as string) || ''
      return truncatePath(filePath, 40)
    }

    case 'NotebookEdit': {
      const notebookPath = (input.notebook_path as string) || ''
      return truncatePath(notebookPath, 40)
    }

    case 'Bash': {
      const command = (input.command as string) || ''
      return command.length > 50 ? command.slice(0, 50) + '...' : command
    }

    case 'Glob': {
      const pattern = (input.pattern as string) || ''
      return pattern
    }

    case 'Grep': {
      const pattern = (input.pattern as string) || ''
      return pattern.length > 30 ? pattern.slice(0, 30) + '...' : pattern
    }

    case 'WebSearch': {
      const query = (input.query as string) || ''
      return query.length > 40 ? query.slice(0, 40) + '...' : query
    }

    case 'WebFetch': {
      const url = (input.url as string) || ''
      // Show domain + path, truncate if needed
      try {
        const urlObj = new URL(url)
        const display = urlObj.hostname + urlObj.pathname
        return display.length > 40 ? display.slice(0, 40) + '...' : display
      } catch {
        return url.length > 40 ? url.slice(0, 40) + '...' : url
      }
    }

    case 'Task':
      // Sub-agent - handled in Story 2b.3, but provide fallback
      return (input.subagent_type as string) || 'Agent task'

    default:
      return name
  }
}

function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path
  return '...' + path.slice(-(maxLength - 3))
}
```

### Error Detection Logic

```typescript
function isToolError(toolCall: ToolUseBlock, result: ToolResultBlock | null): boolean {
  if (!result) return false

  // Check explicit error indicator first (from Claude Code API)
  if (result.is_error === true) {
    return true
  }

  // Fallback: pattern matching for common error signatures
  const content = result.content.toLowerCase()
  return (
    content.includes('error:') ||
    content.includes('failed') ||
    content.includes('not found') ||
    content.includes('permission denied') ||
    content.includes('enoent') ||
    content.startsWith('error')
  )
}

function getErrorMessage(result: ToolResultBlock): string {
  const content = result.content
  // Extract first line or first 100 chars as error preview
  const firstLine = content.split('\n')[0]
  return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine
}
```

### ConversationView Integration

**Current State (from Story 2b.1):** ConversationView only renders MessageBubble for all messages. It does NOT currently handle tool_use blocks.

**This Story Must:** Update ConversationView to detect and render ToolCallCard for messages containing toolUseBlocks.

Update `ConversationView.tsx` to render tool calls:

```typescript
import { Fragment, useState, useCallback } from 'react'
import { ToolCallCard } from './ToolCallCard'

function ConversationView({ messages, sessionId }: ConversationViewProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  const toggleTool = useCallback((toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }, [])

  // For MVP, render messages simply
  // Tool pairing will be implemented when loading real conversation data
  return (
    // ... existing ScrollArea structure ...
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((msg) => {
        // Check if message contains tool_use blocks
        if (msg.role === 'assistant' && msg.toolUseBlocks) {
          return (
            <Fragment key={msg.uuid}>
              {msg.content && (
                <MessageBubble key={`${msg.uuid}-text`} role="assistant" content={msg.content} timestamp={msg.timestamp} />
              )}
              {msg.toolUseBlocks.map((tool) => (
                <ToolCallCard
                  key={tool.id}
                  toolCall={tool}
                  result={msg.toolResults?.find(r => r.tool_use_id === tool.id) || null}
                  isExpanded={expandedTools.has(tool.id)}
                  onToggle={() => toggleTool(tool.id)}
                />
              ))}
            </Fragment>
          )
        }

        return <MessageBubble key={msg.uuid} {...msg} />
      })}
    </div>
  )
}
```

### Mock Data for Testing

```typescript
// Add to types.ts or separate mock file

export const MOCK_TOOL_CALLS: ToolUseBlock[] = [
  {
    type: 'tool_use',
    id: 'toolu_01Read001',
    name: 'Read',
    input: { file_path: 'src/main/index.ts' }
  },
  {
    type: 'tool_use',
    id: 'toolu_01Bash002',
    name: 'Bash',
    input: { command: 'npm run build && npm test' }
  },
  {
    type: 'tool_use',
    id: 'toolu_01Edit003',
    name: 'Edit',
    input: {
      file_path: 'src/renderer/App.tsx',
      old_string: 'const foo = 1',
      new_string: 'const foo = 2'
    }
  }
]

export const MOCK_TOOL_RESULTS: ToolResultBlock[] = [
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Read001',
    content: 'import { app } from "electron"\n\napp.whenReady().then(() => {\n  // ...\n})'
  },
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Bash002',
    content: 'Build succeeded\n\nTest Suites: 42 passed\nTests: 310 passed'
  },
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Edit003',
    content: 'Edit successful'
  }
]

export const MOCK_ERROR_RESULT: ToolResultBlock = {
  type: 'tool_result',
  tool_use_id: 'toolu_error001',
  content: 'Error: ENOENT: no such file or directory, open "/path/to/missing-file.ts"',
  is_error: true  // Explicit error indicator from Claude Code API
}
```

### File Structure

**New Files:**
- `src/renderer/src/features/sessions/components/ToolCallCard.tsx`
- `src/renderer/src/features/sessions/components/ToolCallCard.test.tsx`
- `src/renderer/src/shared/utils/formatToolSummary.ts`
- `src/renderer/src/shared/utils/formatToolSummary.test.ts`
- `src/renderer/src/shared/utils/pairToolCalls.ts`
- `src/renderer/src/shared/utils/pairToolCalls.test.ts`

**Modified Files:**
- `src/renderer/src/features/sessions/components/types.ts` - Add tool types
- `src/renderer/src/features/sessions/components/index.ts` - Export ToolCallCard and types
- `src/renderer/src/features/sessions/components/ConversationView.tsx` - Integrate ToolCallCard
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx` - Add tool rendering tests
- `src/renderer/src/shared/utils/index.ts` - Export formatToolSummary, pairToolCalls

### Scope Boundaries

**In Scope:**
- ToolCallCard component (collapsed/expanded states)
- Tool summary generation
- Error state display
- Tool call/result pairing utility
- Integration into ConversationView with mock data

**Out of Scope (Future Stories):**
- Sub-agent bubbles (Story 2b.3) - Task tool calls render as placeholder for now
- Real conversation data loading from JSONL (Epic 3b)
- File diff visualization for Edit tools (future enhancement)
- Syntax highlighting for code in tool output (future enhancement)

### Dependencies

**To Install (Task 3):**
- `@radix-ui/react-collapsible` - For expand/collapse animation
  ```bash
  npm install @radix-ui/react-collapsible
  ```

**Existing (verified):**
- Tailwind CSS v4 - Styling (already configured)
- `vitest` + `@testing-library/react` - Testing (already installed)
- `@radix-ui/react-scroll-area` - Already installed
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs` - Already installed

**Existing Utilities (REUSE):**
- `cn` - `src/renderer/src/shared/utils/cn.ts` (verified exists)

### Barrel File Updates

**Update `src/renderer/src/features/sessions/components/index.ts`:**
```typescript
// ... existing exports ...
// Story 2b.2: Tool Call Display
export { ToolCallCard } from './ToolCallCard'
export type { ToolCallCardProps } from './ToolCallCard'
export type { ToolUseBlock, ToolResultBlock, ToolPair } from './types'
export { MOCK_TOOL_CALLS, MOCK_TOOL_RESULTS, MOCK_ERROR_RESULT, MOCK_MESSAGES_WITH_TOOLS } from './types'
```

**Update `src/renderer/src/shared/utils/index.ts`:**
```typescript
// ... existing exports ...
// Story 2b.2: Tool Call Display
export { formatToolSummary } from './formatToolSummary'
export { pairToolCallsWithResults } from './pairToolCalls'
```

### Testing Strategy

**ToolCallCard Tests:**
- Renders collapsed state with tool name and summary
- Renders chevron icon in collapsed state
- Expands on click showing input parameters
- Expands showing output/result
- Collapses when clicking expanded card
- Renders error state with red styling
- Shows error message in collapsed error state

**formatToolSummary Tests:**
- Formats Read tool with file path
- Formats Write tool with file path
- Formats Edit tool with file path
- Formats NotebookEdit tool with notebook_path
- Formats Bash tool with truncated command
- Formats Glob tool with pattern
- Formats Grep tool with pattern (truncates long patterns)
- Formats WebSearch tool with query
- Formats WebFetch tool with URL (shows domain+path)
- Truncates long file paths with "..." prefix
- Returns tool name for unknown tools

**pairToolCalls Tests:**
- Pairs tool_use with matching tool_result
- Handles tool_use without result
- Handles multiple tool calls in sequence
- Returns empty map for no tool calls

### Performance Considerations

- NFR3: Tool expansion < 100ms (client-side only, no IPC)
- Use Radix Collapsible for smooth animations
- Truncate very long outputs to prevent render blocking
- Virtualization deferred (MVP: render all tools)

### References

- [Source: epics.md#Epic 2b Story 2b.2] - Acceptance criteria and FR34, FR35, FR38 mapping
- [Source: ux-design-specification.md#Tool Bubble] - Visual specifications
- [Source: architecture.md#Content Block Types] - ToolUseBlock, ToolResultBlock interfaces
- [Source: architecture.md#Tool Call/Result Pairing] - Pairing logic reference
- [Source: project-context.md#Framework-Specific Rules] - React/component patterns
- [Source: 2b-1-message-bubble-components.md#Dev Notes] - Previous story patterns

## Story Quality Review

### Review Date
2026-01-23 (Third Review Pass)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Create-Story Workflow

### Review Outcome
**APPROVED** - All issues from review passes 1-3 identified and fixed.

### Issues Found and Fixed

#### CRITICAL Issues (2 total - all fixed in prior passes)

**C1: Missing @radix-ui/react-collapsible dependency** (First Pass)
- Problem: Story assumed `@radix-ui/react-collapsible` was installed, but it is NOT in package.json
- Fix: Added explicit npm install command to Task 3 and Dependencies section
- Verified: Only these Radix packages are installed: react-context-menu, react-dialog, react-dropdown-menu, react-scroll-area, react-tabs, react-tooltip

**C2: Missing is_error field in ToolResultBlock** (Second Pass)
- Problem: The Claude Code API includes an `is_error: boolean` field in tool_result blocks, but this was not documented
- Fix: Added `is_error?: boolean` to ToolResultBlock interface and updated isToolError() to check this field first before falling back to string matching

#### HIGH Issues (2 total - all fixed in prior passes)

**H1: Missing ConversationMessage type extension** (First Pass)
- Problem: Story didn't clarify that ConversationMessage needs new optional fields for toolUseBlocks and toolResults
- Fix: Added explicit type extension in Task 5 showing how to extend the interface

**H2: WebSearch and WebFetch tools missing from formatToolSummary** (Second Pass)
- Problem: These Claude Code tools were not mentioned in summary generation
- Fix: Added handling for WebSearch (show query) and WebFetch (show URL with domain+path)

#### MEDIUM Issues (6 total - all fixed)

**M1: ConversationView current state not documented** (First Pass)
- Problem: Story didn't clarify what ConversationView currently looks like (message-only rendering)
- Fix: Added "Current State" note in ConversationView Integration section

**M2: NotebookEdit missing from Task 2 requirements** (Second Pass)
- Problem: NotebookEdit was in the implementation code but not in the task list
- Fix: Added NotebookEdit to Task 2 requirements with notebook_path handling

**M3: NotebookEdit uses notebook_path not file_path** (Second Pass)
- Problem: NotebookEdit uses `notebook_path` parameter, not `file_path`
- Fix: Updated formatToolSummary to handle NotebookEdit separately with correct parameter name

**M4: Missing MOCK_MESSAGES_WITH_TOOLS in barrel file export** (Third Pass)
- Problem: Task 5 mentions creating `MOCK_MESSAGES_WITH_TOOLS` but barrel file update didn't include it
- Fix: Added `MOCK_MESSAGES_WITH_TOOLS` to the index.ts export list

**M5: Code examples missing required imports** (Third Pass)
- Problem: Radix Collapsible example didn't show ChevronRight import from lucide-react or cn import
- Fix: Added complete imports to code example (ChevronRight, cn, formatToolSummary)

**M6: Task 6 pairToolCalls unclear scope for MVP** (Third Pass)
- Problem: Referenced `ConversationEvent` type that doesn't exist yet; unclear what's needed for MVP mock data vs Epic 3b real data
- Fix: Clarified that MVP uses simplified `findToolResult()` while full `pairToolCallsWithResults()` is for Epic 3b

#### LOW Issues (3 total - all fixed in Third Pass)

**L1: Missing ChevronRight icon specification in Task 1** (Third Pass)
- Problem: Task 1 didn't specify which icon library/component to use for chevron
- Fix: Added explicit requirement to use `ChevronRight` from `lucide-react` (matches project pattern)

**L2: formatToolSummary tests missing WebSearch/WebFetch/NotebookEdit** (Third Pass)
- Problem: Testing Strategy didn't include tests for the newly added tool types
- Fix: Updated testing strategy to include NotebookEdit, WebSearch, WebFetch test cases

**L3: ConversationView integration code missing Fragment import** (Third Pass)
- Problem: Code example used `Fragment` without showing the import
- Fix: Added `import { Fragment, useState, useCallback } from 'react'` to code example

### Acceptance Criteria Verification
- AC1 (Tool card styling): COMPLETE - Blue-tinted bg, blue left border, monospace font specified
- AC2 (Collapsed state): COMPLETE - Tool name + summary + chevron documented, all 10 tools covered
- AC3 (Expand/collapse): COMPLETE - Radix Collapsible usage with input/output display, complete imports shown
- AC4 (Error state): COMPLETE - Red border, red bg, explicit is_error check + fallback string matching

### Validation Results
- Story completeness: PASS
- Technical accuracy: PASS (types aligned with Claude Code API, imports verified against codebase)
- LLM optimization: PASS (actionable code examples with complete imports, clear requirements)

### Recommendation
Story is complete and ready for dev-story execution.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Test failure in `ToolCallCard.test.tsx`: SVG elements use `getAttribute('class')` not `className` property - fixed
- Prettier warnings for long lines in test files - fixed with `--fix`

### Completion Notes List

- Installed `@radix-ui/react-collapsible` v1.1.12 for expand/collapse animations
- Added CSS keyframes (slideDown/slideUp) to main.css for Radix Collapsible animations
- Created ToolUseBlock, ToolResultBlock, and ToolPair TypeScript types in types.ts
- Extended ConversationMessage interface with optional toolUseBlocks and toolResults fields
- Created formatToolSummary utility with support for Read, Write, Edit, NotebookEdit, Bash, Glob, Grep, WebSearch, WebFetch, and Task tools
- Created pairToolCalls utility with findToolResult, isToolError, and getErrorPreview functions
- Created ToolCallCard component with collapsed/expanded states, blue styling for normal tools, red styling for errors
- Integrated ToolCallCard into ConversationView with expansion state management via useState Set
- Added comprehensive tests: 17 tests for formatToolSummary, 18 tests for pairToolCalls, 22 tests for ToolCallCard, 6 integration tests for ConversationView
- All 375 tests pass, TypeScript compiles cleanly, ESLint passes

### File List

**New Files:**
- src/renderer/src/features/sessions/components/ToolCallCard.tsx
- src/renderer/src/features/sessions/components/ToolCallCard.test.tsx
- src/renderer/src/shared/utils/formatToolSummary.ts
- src/renderer/src/shared/utils/formatToolSummary.test.ts
- src/renderer/src/shared/utils/pairToolCalls.ts
- src/renderer/src/shared/utils/pairToolCalls.test.ts

**Modified Files:**
- src/renderer/src/assets/main.css (added Collapsible animation keyframes)
- src/renderer/src/features/sessions/components/types.ts (added tool types, extended ConversationMessage)
- src/renderer/src/features/sessions/components/index.ts (added exports for ToolCallCard and types)
- src/renderer/src/features/sessions/components/ConversationView.tsx (integrated ToolCallCard)
- src/renderer/src/features/sessions/components/ConversationView.test.tsx (added tool card tests)
- src/renderer/src/shared/utils/index.ts (added formatToolSummary and pairToolCalls exports)
- package.json (added @radix-ui/react-collapsible dependency)
- package-lock.json (updated)

### Change Log

- 2026-01-23: Implemented Story 2b.2 - Tool Call Display. Created ToolCallCard component for rendering tool calls as collapsible cards with blue styling (normal) and red styling (errors). Includes formatToolSummary utility for generating human-readable tool summaries and pairToolCalls utility for matching tool calls to results. Integrated into ConversationView with managed expansion state.
- 2026-01-23 (Code Review #1): Fixed 5 issues found during adversarial code review:
  - **M1 (MEDIUM)**: Fixed CSS animation not working - changed from Tailwind data-attribute syntax to proper CSS attribute selectors targeting `[data-state='open'].collapsible-content`
  - **M2 (MEDIUM)**: Implemented "Show more/Show less" button for long tool outputs (>500 chars) as specified in Task 3
  - **L1 (LOW)**: Added integration test for error state tool cards in ConversationView
  - **L2 (LOW)**: Added test for rendering multiple tool blocks in single message
  - **L3 (LOW)**: Added Skill tool type handling in formatToolSummary (shows skill name)
  - Test count increased from 375 to 383 (8 new tests added)
- 2026-01-23 (Code Review #2): Fixed 2 issues found during adversarial code review:
  - **M1 (MEDIUM)**: Fixed tool-only assistant messages (no text content) not displaying timestamps. Added standalone timestamp display below tool cards when msg.content is empty. Import added: formatMessageTimestamp.
  - **L1 (LOW)**: Added test for tool-only messages (assistant message with toolUseBlocks but empty content string). Verifies no MessageBubble rendered and timestamp displayed for temporal context.
  - Test count increased from 383 to 384 (1 new test added)
- 2026-01-23 (Code Review #3): Fixed 1 issue found during adversarial code review:
  - **L1 (LOW)**: Added truncation for Glob tool patterns (40 char limit with "..." suffix) for consistency with other tools. Glob was the only tool not truncating long inputs.
  - Added test for long Glob patterns truncation.
  - Test count increased from 384 to 385 (1 new test added)
