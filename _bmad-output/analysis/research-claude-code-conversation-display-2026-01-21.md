# Research Report: Claude Code Conversation Parsing & Display

**Date:** 2026-01-21
**Topic:** How to parse, display, and render Claude Code conversations in Grimoire's Sessions plugin
**Research Type:** Technical, Community, Documentation

---

## Executive Summary

This research establishes how to parse Claude Code session files and display them with an appealing UI in Grimoire. Key findings:

1. **Session files are JSONL** stored at `~/.claude/projects/<encoded-path>/<uuid>.jsonl`
2. **Event types are well-defined**: user, assistant, tool_use, tool_result, summary, file-history-snapshot
3. **Sub-agents** have their own JSONL files at `<session>/subagents/agent-<id>.jsonl` with `isSidechain: true`
4. **File edits** can be detected via `Write` and `Edit` tool_use events with `file_path` in input
5. **Community has built 7+ parsing tools** - we can learn from their approaches
6. **UI patterns are mature** - Vercel AI SDK, shadcn-chat, assistant-ui provide proven components

---

## Part 1: Claude Code Storage Format

### 1.1 Folder Structure

```
~/.claude/
├── history.jsonl                    # Global command index (all sessions)
├── projects/                        # Main project storage
│   └── -<encoded-path>/             # Path URL-encoded (/ → -)
│       ├── <uuid>.jsonl             # Main session file
│       ├── <uuid>/
│       │   └── subagents/
│       │       └── agent-<6-char>.jsonl  # Sub-agent conversations
│       └── tool-results/            # Large tool outputs
├── file-history/                    # File edit backups
│   └── <session-uuid>/
│       └── <hash>@v<version>        # Versioned file backups
├── todos/                           # TodoWrite tool state
├── debug/                           # Debug logs
├── shell-snapshots/                 # Shell env per session
└── cache/                           # Various caches
```

### 1.2 File Naming Conventions

| Item           | Pattern               | Example                                      |
| -------------- | --------------------- | -------------------------------------------- |
| Project folder | `-<path-encoded>`     | `-Users-teazyou-dev-grimoire`                |
| Session file   | `<uuid>.jsonl`        | `00868b4f-969f-45dd-8d33-15a449510bc0.jsonl` |
| Sub-agent file | `agent-<6-hex>.jsonl` | `agent-a951b4d.jsonl`                        |
| File backup    | `<hash>@v<n>`         | `f1230fdacb9e65df@v2`                        |

### 1.3 Core Event Types

Each line in a `.jsonl` file is one of these event types:

#### USER MESSAGE

```json
{
  "type": "user",
  "parentUuid": null,
  "uuid": "01cc0e18-...",
  "sessionId": "00868b4f-...",
  "timestamp": "2026-01-21T09:22:02.967Z",
  "cwd": "/Users/teazyou/dev/grimoire",
  "gitBranch": "main",
  "version": "2.1.14",
  "isSidechain": false,
  "message": {
    "role": "user",
    "content": "Your prompt here"
  }
}
```

#### ASSISTANT MESSAGE

```json
{
  "type": "assistant",
  "parentUuid": "01cc0e18-...",
  "uuid": "097139a8-...",
  "sessionId": "00868b4f-...",
  "timestamp": "2026-01-21T09:22:06.769Z",
  "requestId": "req_011CX...",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Response text..." },
      { "type": "tool_use", "id": "toolu_01HX...", "name": "Read", "input": {...} }
    ],
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 6127,
      "cache_read_input_tokens": 17560,
      "output_tokens": 3
    }
  }
}
```

#### TOOL RESULT (follows assistant tool_use)

```json
{
  "type": "user",
  "parentUuid": "097139a8-...",
  "uuid": "7a979fb3-...",
  "sourceToolAssistantUUID": "097139a8-...",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01HX...",
        "content": "File contents here..."
      }
    ]
  },
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file.ts",
      "content": "...",
      "numLines": 150
    }
  }
}
```

#### SESSION SUMMARY (first line of resumed sessions)

```json
{
  "type": "summary",
  "summary": "Brief summary of conversation so far...",
  "leafUuid": "uuid-of-last-message"
}
```

#### FILE HISTORY SNAPSHOT

```json
{
  "type": "file-history-snapshot",
  "messageId": "01cc0e18-...",
  "snapshot": {
    "trackedFileBackups": {
      "path/to/file.md": {
        "backupFileName": "f1230fdacb9e65df@v2",
        "version": 2,
        "backupTime": "2026-01-21T09:32:05.718Z"
      }
    }
  }
}
```

---

## Part 2: Detection Patterns for Grimoire

### 2.1 Detecting File Edits

**Write Tool (creates/overwrites file):**

```typescript
function isFileWrite(event: ConversationEvent): boolean {
  if (event.type !== 'assistant') return false
  return event.message.content.some((c) => c.type === 'tool_use' && c.name === 'Write')
}

function extractFilePath(toolUse: ToolUseContent): string {
  return toolUse.input.file_path
}
```

**Edit Tool (modifies existing file):**

```typescript
function isFileEdit(event: ConversationEvent): boolean {
  if (event.type !== 'assistant') return false
  return event.message.content.some((c) => c.type === 'tool_use' && c.name === 'Edit')
}

function extractEditDetails(toolUse: ToolUseContent): EditDetails {
  return {
    filePath: toolUse.input.file_path,
    oldString: toolUse.input.old_string,
    newString: toolUse.input.new_string
  }
}
```

### 2.2 Detecting Sub-Agent Spawns (Task Tool)

```typescript
function isSubAgentSpawn(event: ConversationEvent): boolean {
  if (event.type !== 'assistant') return false
  return event.message.content.some((c) => c.type === 'tool_use' && c.name === 'Task')
}

function extractSubAgentInfo(toolUse: ToolUseContent): SubAgentInfo {
  return {
    description: toolUse.input.description,
    subagentType: toolUse.input.subagent_type,
    prompt: toolUse.input.prompt,
    model: toolUse.input.model
  }
}
```

### 2.3 Detecting Sub-Agent Conversations

Sub-agent files are identified by:

- Location: `<session-uuid>/subagents/agent-<id>.jsonl`
- Field: `isSidechain: true` in every event
- Field: `agentId: "<6-char-hex>"` in every event

```typescript
function isSubAgentConversation(event: ConversationEvent): boolean {
  return event.isSidechain === true
}

function getSubAgentId(event: ConversationEvent): string | null {
  return event.agentId ?? null
}
```

### 2.4 Building Message Threading

Use `parentUuid` to construct conversation tree:

```typescript
interface MessageNode {
  event: ConversationEvent
  children: MessageNode[]
}

function buildMessageTree(events: ConversationEvent[]): MessageNode[] {
  const nodeMap = new Map<string, MessageNode>()
  const roots: MessageNode[] = []

  for (const event of events) {
    const node = { event, children: [] }
    nodeMap.set(event.uuid, node)

    if (event.parentUuid && nodeMap.has(event.parentUuid)) {
      nodeMap.get(event.parentUuid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
```

### 2.5 Pairing Tool Calls with Results

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

---

## Part 3: Streaming Format (Real-Time)

When using `--output-format stream-json`, Claude Code emits NDJSON events:

### 3.1 Stream Event Types

| Event Type            | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `message_start`       | Beginning of response, includes model/ID          |
| `content_block_start` | Start of text/tool_use/thinking block             |
| `content_block_delta` | Incremental update (text_delta, input_json_delta) |
| `content_block_stop`  | End of content block                              |
| `message_delta`       | Top-level changes (stop_reason, usage)            |
| `message_stop`        | Final event, response complete                    |
| `ping`                | Keep-alive, safe to ignore                        |
| `error`               | Error events                                      |

### 3.2 Parsing Streaming Content

```typescript
interface StreamEvent {
  type: 'stream_event';
  event: {
    type: 'content_block_delta' | 'content_block_start' | ...;
    index?: number;
    delta?: {
      type: 'text_delta' | 'input_json_delta';
      text?: string;
      partial_json?: string;
    };
    content_block?: {
      type: 'text' | 'tool_use';
      id?: string;
      name?: string;
    };
  };
}

function handleStreamEvent(event: StreamEvent, state: StreamState) {
  switch (event.event.type) {
    case 'content_block_start':
      if (event.event.content_block?.type === 'tool_use') {
        state.currentToolCall = {
          id: event.event.content_block.id,
          name: event.event.content_block.name,
          inputJson: ''
        };
      }
      break;

    case 'content_block_delta':
      if (event.event.delta?.type === 'text_delta') {
        state.currentText += event.event.delta.text;
      } else if (event.event.delta?.type === 'input_json_delta') {
        state.currentToolCall.inputJson += event.event.delta.partial_json;
      }
      break;

    case 'content_block_stop':
      if (state.currentToolCall) {
        state.completedToolCalls.push({
          ...state.currentToolCall,
          input: JSON.parse(state.currentToolCall.inputJson)
        });
        state.currentToolCall = null;
      }
      break;
  }
}
```

---

## Part 4: UI Display Recommendations

### 4.1 Recommended Tech Stack

Based on research, the best-fit stack for Grimoire (Electron + React):

| Layer           | Choice                                    | Rationale                       |
| --------------- | ----------------------------------------- | ------------------------------- |
| UI Components   | **shadcn/ui** + **Radix UI**              | Already in architecture doc     |
| Chat Components | **shadcn-chat**                           | Pre-built message bubbles       |
| Streaming       | **Custom NDJSON parser**                  | More control than Vercel AI SDK |
| State           | **Zustand**                               | Already in architecture doc     |
| Code Blocks     | **react-syntax-highlighter** or **shiki** | Syntax highlighting             |

### 4.2 Message Type Visual Distinction

```css
/* User messages - right aligned */
.message--user {
  @apply flex justify-end;
  .bubble {
    @apply bg-blue-500 text-white rounded-lg px-4 py-2;
  }
}

/* Assistant messages - left aligned with avatar */
.message--assistant {
  @apply flex gap-3;
  .avatar {
    @apply w-8 h-8 rounded-full bg-purple-500;
  }
  .bubble {
    @apply bg-gray-100 text-gray-900 rounded-lg px-4 py-2;
  }
}

/* Tool call - collapsed card */
.message--tool-call {
  @apply border border-gray-200 rounded-lg p-3 bg-gray-50;
  .tool-name {
    @apply font-mono text-sm text-gray-600;
  }
  .tool-summary {
    @apply text-sm text-gray-500;
  }
}

/* Sub-agent - indented with color border */
.message--subagent {
  @apply ml-6 pl-4 border-l-4 border-amber-400;
  .bubble {
    @apply bg-amber-50 text-amber-900;
  }
}

/* File edit - with file icon */
.message--file-edit {
  @apply border border-green-200 rounded-lg overflow-hidden;
  .file-header {
    @apply bg-green-100 px-3 py-2 flex items-center gap-2;
  }
  .file-path {
    @apply font-mono text-sm;
  }
}
```

### 4.3 Component Structure for Grimoire

```
plugins/sessions/src/renderer/
├── ConversationView.tsx        # Main container, maps events to components
├── MessageBubble.tsx           # User/assistant text messages
├── ToolCallCard.tsx            # Collapsed tool call display
├── ToolCallModal.tsx           # Expanded tool details
├── SubAgentBubble.tsx          # Collapsed sub-agent indicator
├── SubAgentTab.tsx             # Full sub-agent conversation (in tab)
├── FileEditCard.tsx            # File write/edit visualization
├── StreamingIndicator.tsx      # "Claude is thinking..." / "Working..."
├── CodeBlock.tsx               # Syntax-highlighted code
└── EventTimeline.tsx           # Right panel navigation
```

### 4.4 Rendering Algorithm

```typescript
function renderConversation(events: ConversationEvent[]): ReactNode[] {
  const rendered: ReactNode[] = [];
  const toolPairs = pairToolCallsWithResults(events);

  for (const event of events) {
    // Skip tool_result events (rendered with their call)
    if (isToolResult(event)) continue;

    if (event.type === 'user' && !isToolResult(event)) {
      rendered.push(<MessageBubble key={event.uuid} role="user" content={event.message.content} />);
    }

    if (event.type === 'assistant') {
      for (const content of event.message.content) {
        if (content.type === 'text') {
          rendered.push(<MessageBubble key={`${event.uuid}-text`} role="assistant" content={content.text} />);
        }

        if (content.type === 'tool_use') {
          const result = toolPairs.get(content.id)?.result;

          if (content.name === 'Task') {
            rendered.push(
              <SubAgentBubble
                key={content.id}
                toolCall={content}
                result={result}
                onOpenInTab={() => openSubAgentTab(content)}
              />
            );
          } else if (content.name === 'Write' || content.name === 'Edit') {
            rendered.push(
              <FileEditCard
                key={content.id}
                toolCall={content}
                result={result}
              />
            );
          } else {
            rendered.push(
              <ToolCallCard
                key={content.id}
                toolCall={content}
                result={result}
              />
            );
          }
        }
      }
    }
  }

  return rendered;
}
```

---

## Part 5: Community Tools & Learnings

### 5.1 Existing JSONL Parsers

| Tool                        | Tech   | Key Feature                         |
| --------------------------- | ------ | ----------------------------------- |
| **claude-JSONL-browser**    | Web    | Converts JSONL → Markdown           |
| **claude-code-log**         | Python | HTML output with timeline           |
| **ClaudeCodeJSONLParser**   | HTML   | Collapsible format, Git integration |
| **claude-code-transcripts** | Python | Publishing tool by Simon Willison   |
| **cclog**                   | Python | TUI interface                       |

### 5.2 Existing UI Projects

| Project                           | Tech             | Key Feature               |
| --------------------------------- | ---------------- | ------------------------- |
| **claude-code-ui** (KyleAMathews) | React, XState    | Kanban view, AI summaries |
| **CloudCLI** (siteboon)           | React, WebSocket | Full IDE-like interface   |
| **Claudia GUI**                   | Tauri 2, React   | Desktop app, analytics    |
| **opcode**                        | GUI              | Custom agent creation     |

### 5.3 Key Lessons from Community

1. **JSONL is the single source of truth** - Don't rely on streaming only
2. **Tool results are separate events** - Must pair them with calls
3. **Sub-agents need special handling** - Separate files, `isSidechain` flag
4. **File edits are detectable** - Via Write/Edit tool_use events
5. **Token usage is per-message** - In `message.usage` field
6. **Session continuity uses parentUuid** - Build tree, not flat list

---

## Part 6: Implementation Recommendations for Grimoire

### 6.1 Data Model Extensions

Add to `plugins/sessions/src/shared/types.ts`:

```typescript
interface ConversationEvent {
  type: 'user' | 'assistant' | 'summary' | 'file-history-snapshot'
  uuid: string
  parentUuid: string | null
  sessionId: string
  timestamp: string
  isSidechain: boolean
  agentId?: string // Present if sub-agent
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    model?: string
    usage?: TokenUsage
  }
  toolUseResult?: ToolUseResult
  sourceToolAssistantUUID?: string
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}
```

### 6.2 Parser Implementation

Create `plugins/sessions/src/main/conversation-parser.ts`:

```typescript
import { readFile } from 'fs/promises'

export async function parseConversation(filePath: string): Promise<ConversationEvent[]> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n').filter((line) => line.trim())

  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as ConversationEvent
      } catch (e) {
        console.warn(`Failed to parse line: ${line.slice(0, 100)}`)
        return null
      }
    })
    .filter(Boolean)
}

export function getFileEdits(events: ConversationEvent[]): FileEditInfo[] {
  const edits: FileEditInfo[] = []

  for (const event of events) {
    if (event.type !== 'assistant') continue

    const content = event.message?.content
    if (!Array.isArray(content)) continue

    for (const block of content) {
      if (block.type === 'tool_use' && (block.name === 'Write' || block.name === 'Edit')) {
        edits.push({
          eventUuid: event.uuid,
          timestamp: event.timestamp,
          toolType: block.name as 'Write' | 'Edit',
          filePath: block.input?.file_path as string,
          toolUseId: block.id
        })
      }
    }
  }

  return edits
}

export function getSubAgentSpawns(events: ConversationEvent[]): SubAgentSpawn[] {
  const spawns: SubAgentSpawn[] = []

  for (const event of events) {
    if (event.type !== 'assistant') continue

    const content = event.message?.content
    if (!Array.isArray(content)) continue

    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'Task') {
        spawns.push({
          eventUuid: event.uuid,
          timestamp: event.timestamp,
          toolUseId: block.id,
          description: block.input?.description as string,
          subagentType: block.input?.subagent_type as string,
          model: block.input?.model as string
        })
      }
    }
  }

  return spawns
}
```

### 6.3 IPC Channels to Add

```typescript
// New channels for conversation parsing
'conversation:load' // Load parsed conversation events
'conversation:getFileEdits' // Get file edit events for a session
'conversation:getSubAgents' // Get sub-agent spawns for a session
'conversation:loadSubAgent' // Load sub-agent conversation
```

### 6.4 Sub-Agent Index Update

Update `plugins/sessions/src/main/subagent-index.ts` to also extract from JSONL:

```typescript
export function discoverSubAgentsFromSession(
  sessionPath: string,
  events: ConversationEvent[]
): SubAgentEntry[] {
  const entries: SubAgentEntry[] = [];
  const subagentDir = path.join(path.dirname(sessionPath), path.basename(sessionPath, '.jsonl'), 'subagents');

  // Also check for Task tool_use in events to get metadata
  const spawns = getSubAgentSpawns(events);

  // Scan subagent directory
  if (fs.existsSync(subagentDir)) {
    const files = fs.readdirSync(subagentDir);
    for (const file of files) {
      if (file.match(/^agent-[a-f0-9]+\.jsonl$/)) {
        const agentId = file.match(/agent-([a-f0-9]+)\.jsonl/)?.[1];
        const spawn = spawns.find(s => /* match by timing/context */);

        entries.push({
          agentId: agentId!,
          path: path.join(subagentDir, file),
          parentId: path.basename(sessionPath, '.jsonl'),
          agentType: spawn?.subagentType ?? 'Unknown',
          label: `${spawn?.subagentType ?? 'Agent'}-${agentId?.slice(0, 4)}`
        });
      }
    }
  }

  return entries;
}
```

---

## Part 7: Sources

### Official Documentation

- Claude Code CLI Reference: https://code.claude.com/docs/en/cli-reference
- Claude Code Headless Usage: https://code.claude.com/docs/en/headless.md
- Claude API Streaming: https://platform.claude.com/docs/en/build-with-claude/streaming

### Community Projects

- claude-JSONL-browser: https://github.com/withLinda/claude-JSONL-browser
- claude-code-log: https://github.com/daaain/claude-code-log
- claude-code-ui: https://github.com/KyleAMathews/claude-code-ui
- CloudCLI: https://github.com/siteboon/claudecodeui
- Claudia GUI: https://claudia.so/

### UI Libraries

- shadcn-chat: https://github.com/jakobhoeg/shadcn-chat
- assistant-ui: https://github.com/assistant-ui/assistant-ui
- Vercel AI SDK: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

### Blog Posts & Tutorials

- Building a Visual Dashboard for Claude Code: https://dev.to/thuongx/i-built-a-visual-dashboard-for-claude-code-because-i-was-tired-of-managing-text-files-4j38
- Claude Code's hidden conversation history: https://kentgigger.com/posts/claude-code-conversation-history
- Monitor Claude Code with OpenTelemetry: https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/

---

## Appendix: Sample Event Reference

### A.1 Complete User Message Event

```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/teazyou/dev/grimoire",
  "sessionId": "00868b4f-969f-45dd-8d33-15a449510bc0",
  "version": "2.1.14",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": "Help me implement a new feature"
  },
  "uuid": "01cc0e18-439b-44b1-a50c-78911a58f8d8",
  "timestamp": "2026-01-21T09:22:02.967Z"
}
```

### A.2 Complete Assistant Message with Tool Use

```json
{
  "parentUuid": "16540dd7-981e-4df8-9509-92abc3a65da2",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/teazyou/dev/grimoire",
  "sessionId": "00868b4f-969f-45dd-8d33-15a449510bc0",
  "version": "2.1.14",
  "gitBranch": "main",
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01LDjxQiAed6epRRYQMybedP",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you with that. Let me first read the relevant file."
      },
      {
        "type": "tool_use",
        "id": "toolu_01HXYyux4a6ytdWFrXtqNCKZ",
        "name": "Read",
        "input": {
          "file_path": "/Users/teazyou/dev/grimoire/src/main/index.ts"
        }
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 2000,
      "cache_creation_input_tokens": 6127,
      "cache_read_input_tokens": 17560,
      "output_tokens": 150
    }
  },
  "requestId": "req_011CXLH6MR1sEVoBtj5xAkhY",
  "uuid": "097139a8-c3a9-4f06-8c43-4f13a4da864c",
  "timestamp": "2026-01-21T09:22:06.769Z"
}
```

### A.3 Sub-Agent File Event (isSidechain: true)

```json
{
  "parentUuid": null,
  "isSidechain": true,
  "userType": "external",
  "cwd": "/Users/teazyou/dev/grimoire",
  "sessionId": "1a267890-e5fb-49d3-bc69-d5ce60692203",
  "version": "2.1.2",
  "gitBranch": "main",
  "agentId": "a951b4d",
  "type": "user",
  "message": {
    "role": "user",
    "content": "Research the codebase structure"
  },
  "uuid": "540198cc-1fa8-4679-b673-25d22ef3d1ec",
  "timestamp": "2026-01-09T00:11:01.904Z"
}
```
