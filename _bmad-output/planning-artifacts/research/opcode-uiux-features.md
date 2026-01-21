# Opcode (opcode.sh) - Comprehensive UI/UX Feature Analysis

**Research Date:** January 22, 2026
**Product:** Opcode (formerly Claudia)
**Website:** https://opcode.sh
**GitHub:** https://github.com/winfunc/opcode
**Developer:** Asterisk Labs (Y Combinator-backed startup)
**License:** AGPL
**Stars:** 19,000+ on GitHub

---

## Executive Summary

Opcode is a desktop GUI application for Claude Code, built with Tauri 2, React 18, TypeScript, and Rust. It provides a visual "command center" that bridges the gap between Claude Code's CLI and a full IDE-like experience. The application emphasizes visual session management, custom agent creation, usage analytics, and MCP server management.

---

## 1. Technology Stack & Design System

### Frontend Technologies

- **Framework:** React 18 with TypeScript
- **UI Library:** shadcn/ui components
- **Styling:** Tailwind CSS v4
- **Animations:** Smooth transitions, intersection observer animations, lazy-loading

### Backend Technologies

- **Runtime:** Tauri 2 (Rust-based desktop framework)
- **Database:** SQLite via rusqlite
- **Package Manager:** Bun

### Design Philosophy

- Desktop-first application with native feel
- Local-first architecture (all data stored locally)
- No telemetry or data collection
- Process isolation for security

---

## 2. Visual Design & Theming

### Color Scheme

- **Primary Theme:** Dark theme by default
- **Accent Color:** Orange (#E8704E)
- **Background:** Dark grays with gradient blending
- **Visual Effects:**
  - Glass-effect panels with backdrop blur
  - "Tech-glow" shadow elements for depth
  - Gradient text fills for hero typography
  - Hover animations with scale transformations and glow effects

### Theme Support

- Dark mode (primary)
- Note: Light mode support status unclear from research
- No documented system theme auto-detection

### Typography & Visual Hierarchy

- Large hero typography with gradient fills
- Card-based layouts using semi-transparent dark backgrounds
- Border accents in primary orange tone
- Higher contrast text with bolder font weight

---

## 3. Application Layout & Navigation

### Main Window Structure

- **Tabbed Interface** with main sections:
  1. Projects (CC Projects)
  2. CC Agents
  3. Usage Dashboard
  4. MCP Manager

### Window Controls

- Currently uses macOS-style window controls (colorful buttons on left)
- Feature request exists for OS-native window controls option
- Cross-platform support (macOS, Windows, Linux)

### Navigation Patterns

- Tab-based primary navigation
- Sidebar/list views for projects and sessions
- Card-based content presentation
- Visual timeline for session history

---

## 4. Project & Session Management UI

### Project Browser

- **Visual project browser** displaying all Claude Code projects from `~/.claude/projects/`
- **Smart search functionality** for quick project/session discovery
- **Metadata display** showing:
  - Project names
  - Session history
  - Timestamps
  - First messages

### Session View

- Click on projects to see all sessions
- Each session shows:
  - First message preview
  - Timestamp
  - Quick resume/new session buttons
- Session insight cards with contextual information

### Session Controls

- **Quick Resume:** Instantly continue past work
- **New Session:** Start fresh sessions
- **Session History:** Browse all past sessions

---

## 5. Timeline & Checkpoint System

### Visual Timeline Interface

- **Branching timeline** visualization (Git-style)
- Navigate through session history graphically
- Visual markers for saved session states

### Checkpoint Features

- **Session Versioning:** Create checkpoints at any point during coding sessions
- **Instant Restore:** Jump back to any checkpoint with one click
- **Fork Sessions:** Create new branches from existing checkpoints
- **Diff Viewer:** Side-by-side comparison showing exactly what changed between checkpoints

### Checkpoint Triggers

- Automatic saves at key moments:
  - Before major changes
  - After successful builds
  - When closing sessions
- Manual checkpoint creation

---

## 6. Custom Agent (CC Agents) Interface

### Agent Library View

- Visual collection interface for organizing custom agents
- Agent cards showing name, icon, and configuration summary

### Agent Creation Wizard

- **Name & Icon:** Customize agent identity
- **System Prompt:** Craft custom prompts defining agent personality and rules
- **Model Selection:** Choose between available Claude models (e.g., Claude 3.5 Sonnet, Opus)
- **Permission Controls:**
  - File read/write access toggles
  - Network access controls
  - Sandboxing options

### Agent Execution

- **Background Execution:** Run agents in separate processes for non-blocking operations
- **Execution History:** Detailed logs and performance metrics
- **Process Isolation:** Each agent runs in its own sandbox
- Visual indicators for agent security boundaries

---

## 7. Usage Analytics Dashboard

### Cost Tracking

- Real-time Claude API usage monitoring
- Expense tracking by:
  - Model type
  - Project
  - Time period (date ranges)

### Token Analytics

- Detailed breakdown of token consumption
- Visual charts showing usage trends
- Consumption patterns visualization

### Export & Reporting

- Data export functionality for accounting purposes
- Report generation capabilities

---

## 8. MCP Server Management Interface

### Server Registry

- Centralized UI for managing Model Context Protocol servers
- Server list with status indicators

### Configuration Options

- **Manual Addition:** Add servers via UI form
- **JSON Import:** Import server configurations from JSON
- **Claude Desktop Import:** Bring server configurations from Claude Desktop

### Connection Management

- Connection testing interface
- Verify server connectivity before deployment
- Status indicators for connection state

---

## 9. CLAUDE.md Editor

### Built-in Editor Features

- **Direct Editing:** Modify CLAUDE.md files within the application
- **Live Preview:** Real-time markdown rendering
- **Syntax Highlighting:** Full markdown support

### Project Scanner

- Locate all CLAUDE.md files across projects
- Quick navigation to configuration files

---

## 10. Conversation & Chat Display

### Message Presentation

- Chat-style interface for conversation history
- AI responses wrapped in summary entries
- Code blocks with syntax highlighting

### Session Display

- Session browser sorted by date
- Full conversation formatting
- Tool usage display showing which tools Claude used

---

## 11. Diff Viewer

### Code Comparison

- Side-by-side diff visualization
- Red/green highlighting for changes
- Full diff visualization for every change

### Checkpoint Diffs

- Compare any two checkpoints
- See exactly what changed between states

---

## 12. Security & Permission Visualization

### Sandboxing Indicators

- OS-level sandboxing status display
- Linux seccomp / macOS Seatbelt integration
- Visual indicators for sandbox state

### Permission Controls

- Fine-grained permission toggles
- Filesystem whitelisting configuration
- Network access controls
- Real-time monitoring displays

---

## 13. Known UI/UX Issues & Feedback

### Critical Issues (from Hacker News discussion)

- **Navigation Problems:**
  - Application returns to project list when opening new chats
  - Repetitive clicking required for navigation
  - Scrolling described as "awful" with slow performance
  - Lack of automatic scroll-down during chat generation

- **Visual Presentation Concerns:**
  - Homepage demo video criticized for overwhelming rapid zooming
  - Interface lacks clear visual hierarchy
  - Multiple UI bugs reported
  - Sluggish overall performance

- **Information Architecture:**
  - Code changes hidden in "AI Summary" entries
  - Difficulty viewing actual code modifications
  - Insufficient session titling/context indicators

### Feature Requests

- Window controls style switching (macOS vs native OS)
- Improved scrolling behavior
- Better visual hierarchy
- System theme auto-detection

---

## 14. Platform Support

### Supported Operating Systems

- **macOS:** 11+ (Universal binary: Apple Silicon + Intel)
- **Windows:** 10/11
- **Linux:** Ubuntu 20.04+ (AppImage, .deb)

### System Requirements

- Minimum 4GB RAM (8GB recommended)
- At least 1GB free storage

### Installation

- Homebrew cask available: `opcode`
- Native installers: .dmg, .AppImage, .deb
- Build from source option (requires Rust 1.70+, Bun)

---

## 15. Keyboard Shortcuts

### Current State

- No comprehensive keyboard shortcut documentation found for Opcode specifically
- Likely inherits some patterns from React/Tauri conventions
- Feature gap compared to native Claude Code CLI shortcuts

### Claude Code CLI Shortcuts (for reference)

- `Ctrl+C` - Cancel current operation
- `Ctrl+D` - Exit Claude Code
- `Tab` - Auto-complete
- `Up/Down` arrows - Navigate command history
- `Esc` (double-tap) - Undo recent changes
- `Shift+Tab` - Cycle through input modes
- `Shift+Enter` - Multiline input

---

## 16. Unique Visual Elements

### Animation & Transitions

- Smooth scroll behaviors
- Intersection observer animations
- Lazy-loading image optimization
- Hover scale transformations with glow effects

### Branding

- Logo and icon system
- Consistent orange accent color usage
- "Opcode" typography treatment

### Empty States

- Welcome screen on first launch
- Multiple interaction options displayed
- Onboarding flow for new users

---

## 17. Comparison with Grimoire Goals

### Features Opcode Has That Grimoire Should Consider

1. Visual timeline with checkpoint branching
2. Session forking capability
3. Diff viewer between checkpoints
4. Custom agent creation wizard
5. Built-in CLAUDE.md editor with live preview
6. MCP server management UI
7. Usage analytics dashboard with export
8. Background agent execution with logs
9. Project scanner for CLAUDE.md files

### Potential Gaps/Opportunities for Grimoire

1. Opcode lacks strong light mode support
2. Navigation UX issues reported by users
3. Scrolling performance problems
4. No documented keyboard shortcut system
5. Window controls not OS-native by default
6. Limited theme customization

---

## Sources

- [Opcode Official Website](https://opcode.sh/)
- [Opcode GitHub Repository](https://github.com/winfunc/opcode)
- [Opcode Documentation](https://opcode.sh/docs/)
- [EverydayAIBlog Review](https://everydayaiblog.com/2-claude-code-gui-tools-ide-experience/)
- [Cursor Alternatives - Opcode](https://cursor-alternatives.com/ai-ides/opcode/)
- [Hacker News Discussion](https://news.ycombinator.com/item?id=44933255)
- [It's FOSS News - Claudia](https://itsfoss.com/news/claudia/)
- [Claudia.so Website](https://claudia.so/)
- [Apidog Blog - Claudia Guide](https://apidog.com/blog/claudia-the-gui-for-claude-code/)
- [Twitter/X Announcement](https://x.com/getAsterisk/status/1964262082565611873)
- [GitHub Issues](https://github.com/winfunc/opcode/issues)
