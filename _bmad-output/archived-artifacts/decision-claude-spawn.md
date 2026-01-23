# Grimoire - Claude Code Integration

**Status:** Validated with working prototype | **Date:** 2026-01-22

## Summary

**Hybrid approach:** Normal messages via `claude -p` (stream-json), rewind/edit via Claude Agent SDK.

```
NORMAL MESSAGES (90%):
  claude -p --input-format stream-json --output-format stream-json \
         --verbose --replay-user-messages --resume <session-id>
  └→ stdin: {"type":"user","message":{...}}
  └→ stdout: real-time JSONL (tools, responses, result)

REWIND/EDIT (10%):
  SDK query({ resume, resumeSessionAt, forkSession: true })
  └→ Returns new session ID
  └→ Continue with -p mode
```

## Why Hybrid?

| `-p` mode                  | SDK                                              |
| -------------------------- | ------------------------------------------------ |
| ✅ Simple request-response | ✅ Has `resumeSessionAt` for conversation rewind |
| ✅ Clean process lifecycle | ✅ Has `rewindFiles()` for file restore          |
| ✅ No zombie processes     | ✅ Handles complexity internally                 |
| ❌ No native rewind        | ❌ Adds dependency, sends "Continue." artifact   |

---

## Implementation

### Sending Messages

```javascript
const args = [
  '-p',
  '--input-format',
  'stream-json', // Required for replay-user-messages
  '--output-format',
  'stream-json',
  '--verbose',
  '--replay-user-messages', // Get checkpoint UUIDs
  '--dangerously-skip-permissions'
]
if (sessionId) args.push('--resume', sessionId)

const claude = spawn('claude', args, {
  env: {
    ...process.env,
    CLAUDE_CONFIG_DIR: '/path/to/config', // Optional isolation
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1'
  },
  cwd: projectDirectory,
  stdio: ['pipe', 'pipe', 'pipe']
})

// Send prompt via stdin (NOT CLI arg)
claude.stdin.write(
  JSON.stringify({
    type: 'user',
    message: { role: 'user', content: 'Your prompt here' }
  }) + '\n'
)
claude.stdin.end()

// Parse real-time JSONL from stdout
for await (const line of readline.createInterface({ input: claude.stdout })) {
  const msg = JSON.parse(line)
  // Capture: msg.session_id (for resume), msg.uuid (for checkpoints)
}
```

### Message Types

```javascript
{ type: 'system', subtype: 'init', session_id: '...', tools: [...] }  // First
{ type: 'assistant', message: { content: [...] }, uuid: '...' }       // Response
{ type: 'user', message: { content: [{ type: 'tool_result', ... }] }, uuid: '...' }
{ type: 'result', subtype: 'success', result: '...', session_id: '...' }  // Final
```

### Capturing Checkpoints

With `--replay-user-messages`, every user message has `uuid` field = rewind point.

```javascript
const checkpoints = []
for await (const msg of parseStream(claude.stdout)) {
  if (msg.type === 'user' && msg.uuid) {
    checkpoints.push({ uuid: msg.uuid, timestamp: new Date().toISOString() })
  }
}
```

---

## Session & Rewind

**Session files:** `~/.claude/projects/{project-path-encoded}/{session-id}.jsonl`
(Or `{CLAUDE_CONFIG_DIR}/projects/...` if using isolation)

### Conversation Rewind (SDK)

```javascript
const { query } = require('@anthropic-ai/claude-agent-sdk')

const response = query({
  prompt: 'Continue.', // Non-empty required
  options: {
    resume: originalSessionId,
    resumeSessionAt: checkpointUuid, // Truncates here
    forkSession: true, // Always creates new session
    permissionMode: 'bypassPermissions',
    maxTurns: 1
  }
})

let newSessionId
for await (const msg of response) {
  if (msg.session_id) newSessionId = msg.session_id
}
// Use newSessionId for subsequent -p calls
```

### File Rewind (SDK)

```javascript
const response = query({
  prompt: 'Continue.',
  options: {
    resume: sessionId,
    resumeSessionAt: checkpointUuid,
    enableFileCheckpointing: true,
    forkSession: true
  }
})

for await (const msg of response) {
  if (msg.type === 'system') {
    await response.rewindFiles(checkpointUuid) // Restore files
  }
}
```

### File Rewind (CLI only, no conversation rewind)

```bash
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1 \
claude --resume <session-id> --rewind-files <uuid> -p "" --output-format json
```

---

## Message Editing

**Use case:** User sent "my name is mike", wants to change to "my name is ilan"

```javascript
async function editMessage(messageUuid, newContent) {
  // 1. Find checkpoint BEFORE the message
  const idx = checkpoints.findIndex((c) => c.uuid === messageUuid)
  const priorCheckpoint = checkpoints[idx - 1].uuid

  // 2. Rewind to prior checkpoint (truncates conversation, creates new session)
  const response = query({
    prompt: 'Continue.',
    options: { resume: sessionId, resumeSessionAt: priorCheckpoint, forkSession: true }
  })
  for await (const msg of response) {
    if (msg.session_id) sessionId = msg.session_id
  }

  // 3. Send edited message via -p mode
  return sendMessage(newContent)
}
```

**Result:** Original session preserved, new forked session has edited history.

---

## File Checkpointing

**Tracked:** Files via `Write`, `Edit`, `NotebookEdit` tools
**NOT tracked:** Files via `Bash` commands, external changes

**Storage:** `~/.claude/file-history/{session-id}/{file-hash}@v1`

**Enable:** `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1` or `enableFileCheckpointing: true`

---

## Session Forking

**Key finding:** `resumeSessionAt` ALWAYS creates new session, even with `forkSession: false`.

**Implication:** Every rewind/edit creates new session file. Grimoire must:

- Track "active" session ID
- Optionally hide/archive old sessions
- Store session lineage if needed

---

## Stream vs Folder Data

### Stream (stdout) provides:

| Data                             | Example                                     |
| -------------------------------- | ------------------------------------------- |
| Tool calls (full)                | `{"name":"Task","input":{...}}`             |
| Tool results (summary)           | `{"content":"2 + 2 = 4"}`                   |
| Sub-agent ID/metadata            | `agentId`, `totalDurationMs`, `totalTokens` |
| `parent_tool_use_id`             | Links sub-agent to parent tool call         |
| Session ID, message UUIDs, costs | For resume, checkpoints, billing            |

### Folder required for:

| Data                            | Location                                  |
| ------------------------------- | ----------------------------------------- |
| Sub-agent's full conversation   | `{session-id}/subagents/agent-{id}.jsonl` |
| Sub-agent's internal tool calls | Same file                                 |
| File history snapshots          | `~/.claude/file-history/{session-id}/`    |

```javascript
// Read sub-agent conversation after getting agentId from stream
const subagentFile = path.join(sessionDir, sessionId, 'subagents', `agent-${agentId}.jsonl`)
const messages = fs.readFileSync(subagentFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
```

---

## Prototype

**Location:** `/Users/teazyou/dev/grimoire/prototype/`

| File                   | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `hybrid-session.js`    | Main class: `sendMessage()`, `rewind()`, `editMessage()`, `getRewindPoints()` |
| `test-hybrid.js`       | Conversation rewind test (42 vs 99) ✅                                        |
| `test-file-rewind.js`  | File restore test (ORIGINAL vs MODIFIED) ✅                                   |
| `test-edit-message.js` | Message edit test (mike → ilan) ✅                                            |
| `test-edit-helper.js`  | editMessage() helper test ✅                                                  |

### GrimoireSession API

```javascript
const session = new GrimoireSession({ cwd: '/project', configDir: '/config', debug: true });

for await (const msg of session.sendMessage('hello')) { ... }
await session.rewind('uuid', { rewindFiles: true, fork: true });
for await (const msg of session.editMessage('uuid', 'new content')) { ... }
session.getRewindPoints();  // [{ uuid, timestamp }, ...]
session.getSessionId();     // 'abc123-...'
```

---

## Known Limitations

| Issue                                          | Workaround                                           |
| ---------------------------------------------- | ---------------------------------------------------- |
| "Continue." artifact in rewind                 | Doesn't affect AI memory, just visible in history    |
| Session proliferation                          | Cleanup orphaned sessions, show only "active" branch |
| First message can't be edited                  | No prior checkpoint; hide edit button on first msg   |
| Bash file changes not tracked                  | Document limitation or implement own tracking        |
| `--replay-user-messages` requires both formats | Use stdin JSON input, not CLI arg                    |

---

## Reference

### CLI Flags

| Flag                             | Purpose                           |
| -------------------------------- | --------------------------------- |
| `-p`                             | Print mode (non-interactive)      |
| `--input-format stream-json`     | Accept JSON via stdin             |
| `--output-format stream-json`    | Output JSONL to stdout            |
| `--verbose`                      | Required for stream-json          |
| `--replay-user-messages`         | Include user messages with UUIDs  |
| `--resume <id>`                  | Resume session                    |
| `--rewind-files <uuid>`          | Restore files to checkpoint (CLI) |
| `--dangerously-skip-permissions` | Bypass prompts                    |

### Environment Variables

| Variable                                    | Purpose                 |
| ------------------------------------------- | ----------------------- |
| `CLAUDE_CONFIG_DIR`                         | Isolate config/sessions |
| `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING` | Enable file checkpoints |

### SDK Options

```javascript
query({
  prompt: string | AsyncIterable<SDKUserMessage>,
  options: {
    resume: string,              // Session ID
    resumeSessionAt: string,     // Truncate at UUID
    forkSession: boolean,        // Fork session
    enableFileCheckpointing: boolean,
    cwd: string,
    permissionMode: 'bypassPermissions' | 'default',
    maxTurns: number,
  }
})
```
