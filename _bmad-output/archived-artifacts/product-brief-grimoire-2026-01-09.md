---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments: ['request.md', '_bmad-output/analysis/brainstorming-session-2026-01-09.md']
date: 2026-01-09
author: Teazyou
mvp_scope: 'Core UI Shell + Loading Screen + CC Reader + Live View + Run CC'
---

# Product Brief: Grimoire

## Executive Summary

Grimoire is an Electron-based observability tool for Claude Code workflows. It provides a visual interface to browse, read, and analyze Claude Code sessions - transforming opaque terminal output into a navigable, hierarchical conversation view with progressive disclosure of tool usage and sub-agent conversations.

The MVP delivers five features in priority order: a **Core UI Shell** (Obsidian-inspired panel layout), a **Loading Screen** (CC verification and pre-loading), a **CC Conversation Reader** (historical session review), **Live Session Viewing** (watch running CC in real-time), and **Run CC from Grimoire** (spawn CC instances from within the app).

---

## Core Vision

### Problem Statement

Claude Code is a powerful agentic CLI, but its terminal-based output creates observability blindspots:

- **Sub-agent opacity**: When workflows spawn multiple sub-agents, tracing their individual conversations and decisions is nearly impossible
- **Tool usage buried in noise**: Tool calls (file reads, writes, searches) are mixed with conversational output, making debugging difficult
- **No token visibility**: Context window consumption and token usage per agent is invisible
- **No persistent review**: Reviewing past sessions means navigating raw JSON files in `~/.claude/projects/`

### Problem Impact

For power users running complex multi-agent workflows, these gaps make it difficult to:

- Debug why a workflow failed or produced unexpected results
- Understand what each sub-agent actually did
- Optimize workflows by identifying context window bloat
- Learn from past sessions to improve future prompts

### Why Existing Solutions Fall Short

Claude Code itself provides no UI beyond the terminal. There is no existing tool that:

- Parses CC session data into a visual format
- Provides hierarchical sub-agent navigation
- Offers progressive disclosure of tool call details
- Centralizes session metadata and analytics

### Proposed Solution

An Electron app with an Obsidian-inspired panel layout as the **foundational UI framework**:

**Core UI Shell (MVP Foundation):**

- **Ribbon**: Vertical icon navigation (left edge) for switching between app screens
- **Left Panel**: Collapsible, ~20-30% width, with top bar for panel-specific actions
- **Middle Panel**: Main content area, ~60-70% width, tab-capable
- **Right Panel**: Collapsible, mirrors left panel structure, context-specific content

**CC Conversation Reader (MVP Feature using Core UI):**

- **Left Panel content**: Session list with search/filter, session info toggle
- **Middle Panel content**: Conversation view with:
  - User/Claude message bubbles
  - Sub-agent bubbles (collapsed, click to expand full conversation)
  - Tool call indicators (summary visible, click for detail modal)
- **Right Panel content**: Navigation map (message rectangles for quick scroll)

**Loading Screen (MVP Feature):**

- App logo display during startup
- Claude Code installation verification
- Authentication check (credentials in app's isolated `.claude` folder)
- Pre-loading for performance optimization

### Key Differentiators

- **Sub-agent drill-down**: Click any sub-agent bubble to view its full conversation context
- **Progressive disclosure**: Tool usage shows summary by default, full input/output on click
- **Personal-first design**: Built for the creator's actual workflow needs, not hypothetical "non-technical users"
- **Local-first**: All data stays on your machine, uses your Claude subscription

---

## Target Users

### Primary Users

**Persona: Power User (Self)**

**Profile:**

- Solo developer/creator running Claude Code for diverse tasks
- Uses CC across domains: coding, brainstorming, content creation, marketing, finance, legal
- Runs multiple sessions daily - quick questions to complex multi-agent workflows
- Technical proficiency: intermediate to advanced CLI user

**Problem Experience:**

- Runs workflows with sub-agents but can't trace their individual conversations
- Tool usage details buried in terminal output
- CLI review commands exist but don't provide the visibility needed
- No way to visually navigate or search past sessions

**Success Vision:**

- Open Grimoire, see session list, click one, instantly understand the conversation flow
- Distinguish messages from tool calls at a glance
- Click a sub-agent bubble, see exactly what it did
- Find past sessions by project or timeframe

**Key Workflow:**

1. Run CC session (from terminal or eventually from Grimoire)
2. Open Grimoire CC Reader
3. Select session from list
4. Review conversation with full sub-agent and tool visibility
5. Navigate via message map for long sessions

### Secondary Users

N/A for MVP - personal tool only. Future iterations may expand to developer and non-technical users.

### User Journey

N/A for MVP - single user, no discovery/onboarding required. User builds and uses the tool directly.

---

## Success Metrics

**Core Success Test:**

> "Do I open Grimoire instead of defaulting to CLI?"

### User Success Indicators

| Metric               | Success State                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Sub-agent visibility | "I can finally see what that sub-agent did" - click a sub-agent bubble, understand its full conversation |
| Session retrieval    | "I found a past session in 10 seconds instead of 2 minutes" - list → click → done                        |
| Token understanding  | "I understand my token usage now" - visible context consumption per session/agent                        |

### Usage Indicators

- **Daily use**: Open Grimoire after any complex multi-agent workflow
- **Debugging default**: When something goes wrong, first instinct is Grimoire not terminal scroll
- **Review habit**: Checking past sessions becomes routine, not a chore

### Escape Hatch Failures (MVP Must Avoid)

If any of these happen, the user falls back to CLI:

| Failure Mode                | Result                                                        |
| --------------------------- | ------------------------------------------------------------- |
| Slow startup                | "I'll just run claude, faster than waiting for app"           |
| Missing sessions            | "It didn't pick up my session, useless"                       |
| Unreadable UI               | "I can't tell what's a tool vs message, terminal was clearer" |
| Sub-agent drill-down broken | "I still can't see what the agent did"                        |

### Business Objectives

N/A - Personal tool. No revenue, growth, or market metrics for MVP.

### Key Performance Indicators

N/A - No quantitative KPIs. Success is qualitative: "I use it instead of CLI."

---

## MVP Scope

### Core Features

**1. Core UI Shell (Foundation)**

- Ribbon: Vertical icon navigation for app screens
- Left Panel: Collapsible, ~20-30% width, top action bar
- Middle Panel: Main content, ~60-70% width, tab-capable
- Right Panel: Collapsible, mirrors left structure

**2. Loading Screen**

- App logo display during startup
- Claude Code installation verification
- Authentication check (app's isolated `.claude` folder)
- Pre-loading for performance

**3. CC Conversation Reader (Historical)**

- Left: Session list with search/filter, session info toggle
- Middle: Conversation view with user/Claude bubbles, collapsed sub-agent bubbles (click to expand), tool indicators (click for detail modal)
- Right: Navigation map (message rectangles, click to scroll)

**4. Live Session Viewing**

- Same UI as historical reader, but watching active session
- Real-time message/tool display as CC runs
- Sub-agent visibility as they spawn

**5. Run CC from Grimoire (Final MVP Iteration)**

- Spawn CC instance from within app
- Session appears in live view automatically
- Uses app's isolated `.claude` folder (HOME redirect)

### Out of Scope for MVP

- Workflow library/manager (future feature)
- Sharing/export workflows
- Non-technical user onboarding
- Advanced analytics/reporting dashboard
- Multi-user features
- Community/marketplace features

### MVP Success Criteria

- App startup < 3 seconds
- All CC sessions from `~/.claude/projects/` display correctly
- Sub-agent conversations accessible via click
- Tool details viewable via modal
- Navigation map functional for 100+ message sessions
- Live view updates in real-time without lag
- CC spawn works with correct HOME isolation

### Future Vision

- **Workflow Library**: Save, organize, reuse workflows
- **Workflow Builder**: Visual node-based workflow creation
- **Analytics Dashboard**: Token usage trends, cost tracking
- **Sharing**: Export/import workflows, community library
- **Multi-user**: Team features, shared workflows
