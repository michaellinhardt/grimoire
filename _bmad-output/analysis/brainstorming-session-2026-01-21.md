---
stepsCompleted: [1, 2, 3]
inputDocuments: ['requests/02.brainstorm.subtab.md']
session_topic: 'SubAgent View Feature'
session_goals: 'Implementation details for viewing sub-agent conversations in dedicated tabs'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles Thinking', 'Morphological Analysis']
ideas_generated: ['unified-loader', 'stream-based-updates', 'recursive-index', 'tab-color-tint']
context_file: 'requests/02.brainstorm.subtab.md'
---

# Brainstorming Session Results

**Facilitator:** Teazyou
**Date:** 2026-01-21

## Session Overview

**Topic:** SubAgent View - dedicated tabs for sub-agent conversations
**Goals:** Implementation details for unified conversation display, visual differentiation, live updates

### Context

- Fresh project in specifications period
- Session plugin for agentic orchestration system
- App spawns Claude child processes with stream mode
- App has isolated `.claude` environment

---

## Technique 1: First Principles Thinking

### Investigation Findings

**Conversation Structure (from `.claude/` analysis):**

- Format: JSONL (JSON Lines) - one object per line
- Same message schema for main and sub-agent conversations
- Key fields: `uuid`, `sessionId`, `parentUuid`, `message.role`, `message.content`, `timestamp`

**Main vs Sub-Agent Differences:**

| Aspect      | Main Conversation   | Sub-Agent Conversation                        |
| ----------- | ------------------- | --------------------------------------------- |
| Location    | `{sessionId}.jsonl` | `{sessionId}/subagents/agent-{agentId}.jsonl` |
| isSidechain | `false`             | `true`                                        |
| agentId     | absent              | present                                       |
| parentUuid  | null                | UUID of spawning message in parent            |

**Key Insight:** No explicit parent conversation ID in sub-agents. Linkage via shared `sessionId` + `parentUuid` pointing to tool_use message.

---

## Technique 2: Morphological Analysis

### Parameter Decisions

| Parameter           | Options Considered                  | Decision                                      |
| ------------------- | ----------------------------------- | --------------------------------------------- |
| Tab identification  | Color tint / Different icon / Badge | **Color tint** via `.tab--subagent` CSS class |
| Tab label           | Agent type / Agent ID / Type + ID   | **Type + short ID** ("Explore-a8b2")          |
| How to open         | Bubble click / Events list / Both   | **Both**                                      |
| Conversation loader | Multiple loaders / Single + path    | **Single loader + path param**                |
| Sub-agent discovery | Scan parent / Index on load / Lazy  | **Index on session load**                     |
| Live updates        | File watcher / Stream / Polling     | **Stream from child process** (existing)      |
| Nesting support     | V1 skip / Full support              | **Full support** - uniform handling           |

---

## Implementation Specification

### 1. Tab Visual Differentiation

```css
.tab--subagent {
  /* Color tint applied to tab */
}
```

- Applied when conversation has `isSidechain: true`
- Same styling regardless of nesting depth

### 2. Tab Label Format

```
{agentType}-{shortId}
```

Example: `Explore-a8b2`, `Bash-f3c1`

### 3. Sub-Agent Index Structure

```ts
Map<
  agentId,
  {
    path: string // Path to JSONL file
    parentId: string // sessionId OR agentId (for nested)
    parentMessageUuid: string
    label: string // "Type-shortId"
  }
>
```

- Built on session load
- Flat structure, recursive-friendly
- When ANY conversation loads → scan for its sub-agents → add to index

### 4. Opening Sub-Agent Tabs

**Triggers:**

- Click on bubble (tool_use) in parent conversation
- Click on action in events list

**Action:**

```ts
openSubAgentTab(agentId) → lookup index → open tab with path
```

**Behavior:**

- Opens as new tab
- Parent tab remains open
- No navigation back needed (parent already open)

### 5. Conversation Loader

Single unified loader:

```ts
loadConversation(path: string): Conversation
```

- Works for main or sub-agent
- No conditionals based on conversation type
- Path is only differentiator

### 6. Data Flow

| Scenario             | Source                            |
| -------------------- | --------------------------------- |
| Running conversation | Stream from spawned child process |
| Historical/completed | Read JSONL file once              |
| Sub-agent running    | Stream from its child process     |
| Sub-agent completed  | Read its JSONL file once          |

**No file watcher needed** - app spawns all processes, stream provides real-time data.

### 7. Running Indicator

- Slow blinking `...` on tool_use bubble in parent
- Same `...` on event list item
- Detection: process still running (stream active)
- On completion: `...` disappears, shows final result

### 8. Nesting Support

```
Main Session
├── agent-abc (parent: main)
│   └── agent-xyz (parent: abc) ← nested sub-agent
└── agent-def (parent: main)
```

- Uniform handling at any depth
- Same index structure
- Same visual treatment
- Same loader

### 9. Error Handling

Same as any other error in the application - no special handling for sub-agents.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                   Tab Manager                        │
├─────────────────────────────────────────────────────┤
│  Main Tab          │  Sub-Agent Tab(s)              │
│  .tab              │  .tab.tab--subagent            │
├───────────────────────────────────────────────────────┤
│              Unified Conversation Loader             │
│              loadConversation(path)                  │
├───────────────────────────────────────────────────────┤
│  Running: Stream    │  Historical: File Read         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Sub-Agent Index (flat Map)             │
│  Built on session load, updated when tabs open      │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

Use `/bmad:bmm:workflows:correct-course` to integrate this specification into existing project documents.
