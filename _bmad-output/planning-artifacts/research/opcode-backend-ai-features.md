# Opcode Backend and AI Features Research Report

**Research Date:** 2026-01-22
**Product:** Opcode (opcode.sh) - formerly known as Claudia
**Company:** Asterisk Labs (Y Combinator backed)
**License:** AGPL (Open Source)
**GitHub:** [winfunc/opcode](https://github.com/winfunc/opcode) (19,000+ stars)

---

## Executive Summary

Opcode is a desktop GUI application that serves as a visual wrapper/companion for Claude Code CLI. It does NOT directly interface with Claude's API - instead, it spawns and manages Claude Code CLI processes, parsing their JSONL output for visualization. This architecture makes it a "command center" rather than an independent AI client.

---

## 1. Core Architecture

### Technology Stack
- **Frontend:** React 18 + TypeScript + Vite 6
- **Backend:** Rust with Tauri 2
- **UI Framework:** Tailwind CSS v4 + shadcn/ui
- **Database:** SQLite (via rusqlite)
- **Package Manager:** Bun
- **Platforms:** macOS 11+, Linux (Ubuntu 20.04+), Windows 10/11

### Project Structure
```
opcode/
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── lib/              # API client & utilities
│   └── assets/           # Static assets
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── commands/     # Tauri command handlers
│   │   ├── checkpoint/   # Timeline management
│   │   └── process/      # Process management
│   └── tests/            # Rust test suite
└── public/               # Public assets
```

### System Requirements
- Minimum 4GB RAM (8GB recommended)
- At least 1GB free storage
- Claude API key (for Claude Code CLI)

---

## 2. AI Model Support

### Model Integration Approach
- **NOT a direct API client** - Opcode wraps Claude Code CLI
- Does not call Anthropic API directly
- Model selection passed through to Claude Code CLI
- Supports whatever models Claude Code CLI supports (Sonnet 4, Opus 4.1, etc.)
- Model configuration is per-agent in the GUI

### Supported Models (via Claude Code CLI)
- Claude Sonnet 4 (~$3 per million input tokens)
- Claude Opus 4.1 (higher per-token rates)
- Any model available through Claude Code CLI

---

## 3. Communication Protocols

### Claude Code CLI Communication
- **Protocol:** Spawns Claude Code binary as child process
- **Data Format:** JSONL (JSON Lines) streaming output
- **Command:** Hardcoded `claude` binary execution (no customization currently)
- **Output Parsing:** Real-time JSONL stream parsing

### Tauri IPC (Frontend-Backend)
- **Pattern:** Asynchronous Message Passing
- **Transport:** Custom protocol (ipc://) or postMessage fallback
- **Commands:** Type-safe Rust functions via `#[tauri::command]`
- **Events:** Fire-and-forget bidirectional messaging
- **Channels:** Ordered streaming for real-time data (progress, output)

### Event System for Streaming
- Session-scoped event channels: `claude-output:${sessionId}`
- Message parsing via `handleStreamMessage()`
- Component state management for rendering

---

## 4. Process Architecture

### Process Management
- **Background Execution:** Agents run in separate, isolated processes
- **Non-blocking Operations:** UI remains responsive during agent execution
- **Process Spawning:** Rust backend handles Claude Code process lifecycle
- **Process Cleanup:** Managed termination and resource cleanup

### Security Features
- **Process Isolation:** Each agent runs in separate process
- **Permission Control:** File read/write and network access configurable per-agent
- **OS-Level Sandboxing:** Leverages Linux seccomp and macOS Seatbelt
- **Filesystem Isolation:** Sandbox allows read/write only to working directory
- **Network Isolation:** Proxy-based domain restrictions

### Known Issues
- Claude Code CLI can spawn zombie processes on macOS (process limit exhaustion bug)
- Environment variable whitelist filters certain variables
- Hardcoded claude command without customization support

---

## 5. Session/Conversation Persistence

### SQLite Storage
- **Location:** Local SQLite database
- **Schema:** Sessions table, Messages table
- **Privacy:** All data stored locally, no cloud sync
- **No Telemetry:** Zero data collection

### Session Features
- **Session History:** Full conversation persistence
- **Session Resume:** Continue past coding sessions with context
- **Session Metadata:** Timestamps, first messages, project association
- **Session Versioning:** Checkpoints at any point

### Checkpoint/Timeline System
- **Visual Timeline:** Branching navigation through session history
- **Instant Restore:** One-click jump to any checkpoint
- **Session Forking:** Create new branches from existing checkpoints
- **Diff Viewer:** Visual comparison between checkpoints
- **Non-destructive:** Original timelines preserved

### Export Capabilities
- **JSONL Export:** Raw message data for technical debugging
- **Markdown Export:** Structured documents with syntax highlighting
- **Usage Data Export:** CSV/JSON for accounting and analysis

---

## 6. File System Integration

### Project Discovery
- **Auto-detection:** Scans `~/.claude/projects/` directory
- **Project Browser:** Visual tree-view navigation
- **Search:** Project filtering and metadata display

### CLAUDE.md Management
- **Project Scanner:** Finds all CLAUDE.md files in projects
- **Built-in Editor:** Edit CLAUDE.md directly in app
- **Live Preview:** Real-time markdown rendering
- **Syntax Highlighting:** Full markdown support

### File Permissions (Per-Agent)
- **Read Access:** Configurable file read permissions
- **Write Access:** Configurable file write permissions
- **Network Access:** Configurable network access
- **Working Directory:** Sandbox scoped to project directory

---

## 7. Code Execution Capabilities

### Agent Execution Framework
- **Custom System Prompts:** Define agent behavior
- **Task-based Execution:** Run agents on specific tasks
- **Background Execution:** Non-blocking agent runs
- **Execution Logging:** Detailed performance metrics

### Visualization Widgets
Specialized rendering for different tool outputs:
- **EditWidget:** File diffs using Diff library
- **BashWidget:** Terminal-style output with command highlighting
- **Task widgets:** Status and progress visualization
- **Supported tools:** `task`, `edit`, `multiedit`, `todowrite`, `ls`, `read`, `glob`, `bash`, `write`, `grep`
- **MCP tools:** Prefix `mcp__`

### Output Processing Pipeline
1. Receive JSONL from Claude Code process
2. Parse via `ClaudeStreamMessage` interface
3. Route to appropriate visualization widget
4. Render in React components with auto-scroll

---

## 8. Agent/Tool Systems

### Custom Agent Builder
- **Name & Icon:** Visual identity configuration
- **System Prompt:** Custom instructions
- **Model Selection:** Choose from available Claude models
- **Permission Sets:** File and network access per agent
- **Agent Library:** Collection of purpose-built agents

### Agent Configuration Options
- Task definition
- Working directory
- Model override
- Permission scope
- Execution parameters

### Message Types
1. **System Messages:** Session init (session_id, model, cwd, tools)
2. **Assistant Responses:** AI content with tool invocations
3. **User Messages:** Prompts and tool results
4. **Result Messages:** Completion summaries with cost/duration

---

## 9. Context Management

### Session Context
- **Project-specific Context:** Per-project preservation
- **Session Metadata:** Tracking and persistence
- **Timeline Branching:** Context snapshots via checkpoints
- **Diff Viewer:** Context change visualization

### Context Window Management
- Handled by Claude Code CLI (not Opcode directly)
- Automatic compaction when approaching limits
- Essential information preservation

### Cache System
- **Session Output Caching:** `SessionPersistenceService`
- **Cache Invalidation:**
  - Time-based (5 seconds for running sessions)
  - Session status changes
  - Manual refresh requests

---

## 10. Token Usage Tracking

### Real-time Analytics
- **Cost Tracking:** Monitor Claude API usage in real-time
- **Token Breakdown:** By model, project, and time period
- **Visual Charts:** Usage trends and patterns (Chart.js)
- **Data Export:** Accounting and analysis support

### Metrics Tracked
- Input tokens
- Output tokens
- Cache read tokens
- Cache creation tokens
- Session duration
- Cost in USD

### Related SDK (cc-sdk)
Separate Rust SDK available with:
- Budget limits with alerts
- Full configuration with serde support
- Async/await (Tokio)
- Permission, hooks, MCP server support

---

## 11. MCP (Model Context Protocol) Support

### Server Management Features
- **Central UI:** Manage MCP servers from unified interface
- **Server Registry:** Centralized server list management
- **Claude Desktop Import:** Import existing configurations
- **Connection Testing:** Verify servers before deployment
- **Manual Addition:** Add via UI or JSON import

### Configuration
- Add servers with unique names
- Enable/disable per server
- Reference servers by name in prompts
- Import from Claude Desktop configs

### Current Limitations
- Individual server management only
- No enterprise registry support yet
- No centralized control for teams

---

## 12. Plugin/Extension Architecture

### Current State
- **No Native Plugin System:** Opcode does not have a built-in plugin architecture
- **Extensibility via MCP:** External capabilities through MCP servers
- **Custom Agents:** De facto extension mechanism

### Extension Mechanisms
1. **Custom Agent Creation:** Specialized agents with custom prompts
2. **MCP Server Integration:** External tool integration
3. **Agent Library:** Building collections of purpose-built tools

### Potential Extension Points (not officially supported)
- Tauri command handlers (Rust)
- React component modifications
- SQLite schema extensions

---

## 13. API/SDK Features

### No Public API
- Opcode is a desktop application, not a service
- No REST API or SDK provided
- All operations are local

### Internal APIs
- **Tauri Commands:** Rust-to-frontend communication
- **Event System:** Bidirectional messaging
- **SQLite:** Local data persistence

### Related Projects
- **cc-sdk (Rust):** Separate crate for Claude Code integration
  - Token optimization
  - Budget limits
  - Usage tracking
  - Async/await support

---

## 14. Security and Privacy

### Privacy Features
- **Local-only Storage:** All data on user's machine
- **No Telemetry:** Zero data collection
- **No Cloud Sync:** Offline operation
- **Open Source:** Auditable codebase (AGPL)

### Security Implementation
- **Process Isolation:** Agents in separate processes
- **Permission Control:** Per-agent file/network access
- **OS Sandboxing:** seccomp (Linux), Seatbelt (macOS)
- **Filesystem Sandboxing:** Working directory restriction
- **Network Isolation:** Domain-based proxy restrictions

---

## 15. Comparison with Direct API Clients

| Feature | Opcode | Direct API Client |
|---------|--------|-------------------|
| API Access | Via Claude Code CLI | Direct Anthropic API |
| Model Control | Limited to CC support | Full API control |
| Streaming | JSONL parsing | Native SSE/WebSocket |
| Tool Use | CC's built-in tools | Custom tool definitions |
| Context Window | CC managed | Direct control |
| Token Tracking | Post-hoc analytics | Real-time API response |
| Cost Control | CC's limits | API-level limits |

---

## 16. Key Limitations

1. **CLI Dependency:** Requires Claude Code CLI installed separately
2. **Hardcoded Command:** Cannot customize claude binary path
3. **Environment Filtering:** Whitelist filters env variables
4. **No Direct API:** All AI interaction through CLI wrapper
5. **No Plugin System:** Extensibility limited to agents/MCP
6. **No Collaborative Features:** Single-user desktop app
7. **No Cloud Sync:** Local-only persistence

---

## Sources

- [GitHub - winfunc/opcode](https://github.com/winfunc/opcode)
- [opcode.sh Official Website](https://opcode.sh/)
- [opcode Documentation](https://opcode.sh/docs/)
- [DeepWiki - AI Output Visualization](https://deepwiki.com/getAsterisk/opcode/4.2-ai-output-visualization)
- [Tauri IPC Documentation](https://v2.tauri.app/concept/inter-process-communication/)
- [Claude Code Documentation](https://code.claude.com/docs/en/)
- [Everyday AI Blog - Claude Code GUI Tools](https://everydayaiblog.com/2-claude-code-gui-tools-ide-experience/)
- [Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
