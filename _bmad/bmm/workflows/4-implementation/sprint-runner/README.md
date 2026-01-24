# Sprint Runner - Automated Implementation Orchestrator

## Overview

Sprint Runner is a BMAD workflow that automates the implementation phase of software development. It orchestrates the creation, review, development, and code review of stories in a sprint.

## Architecture (v3)

Sprint Runner v3 uses a **prompt system append architecture** where context is pre-injected into subagents rather than having agents read files from disk. This approach:

- **Reduces token consumption** - Context is loaded once and injected, not re-read by each agent
- **Ensures consistency** - All agents in a batch receive identical frozen context
- **Enables dynamic file injection** - Only relevant files are included based on the phase

### File Structure

```
sprint-runner/
├── README.md                 # This file - system overview
├── workflow.yaml             # BMAD workflow metadata
├── instructions.md           # Workflow logic definition (source of truth)
├── task-taxonomy.yaml        # Task ID definitions for logging
├── commands/                 # v3 Custom Commands
│   ├── sprint-create-story/
│   │   ├── workflow.yaml     # Command metadata + variables
│   │   ├── instructions.xml  # Agent instructions (XML format)
│   │   ├── template.md       # Output file template
│   │   └── checklist.md      # Validation checklist
│   ├── sprint-create-story-discovery/
│   ├── sprint-story-review/
│   ├── sprint-create-tech-spec/
│   ├── sprint-tech-spec-review/
│   ├── sprint-dev-story/
│   ├── sprint-code-review/
│   └── sprint-commit/
├── scripts/
│   └── sprint-log.sh         # Direct subagent logging to SQLite
└── dashboard/
    ├── README.md             # Dashboard-specific documentation
    ├── sprint-log.sh         # Uses date +%s (Unix epoch)
    ├── server/
    │   ├── __init__.py       # Package exports
    │   ├── shared.py         # Path constants, find_project_root()
    │   ├── settings.py       # 9 configurable settings + validation
    │   ├── server.py         # aiohttp HTTP/WebSocket server
    │   ├── orchestrator.py   # v3 with prompt injection
    │   ├── db.py             # SQLite state management
    │   ├── requirements.txt  # Python dependencies
    │   ├── sprint-runner.db  # SQLite database (auto-created)
    │   └── test_*.py         # Test suites
    └── frontend/
        ├── index.html        # Main dashboard page
        ├── css/
        │   └── styles.css    # All CSS
        ├── js/
        │   ├── utils.js      # Pure utility functions
        │   ├── websocket.js  # WebSocket connection
        │   ├── sidebar.js    # Batch history sidebar
        │   ├── controls.js   # Start/stop controls
        │   ├── batch.js      # Batch display
        │   ├── stories.js    # Story cards
        │   ├── operations.js # Active operations
        │   ├── settings.js   # Settings page (API-backed)
        │   └── main.js       # Main entry, state management
        └── assets/           # Static assets
```

## v3 Key Concepts

### Prompt System Append Architecture

The v3 orchestrator uses `--prompt-system-append` to inject context directly into subagent system prompts:

```bash
claude --prompt-system-append "$(cat injection.xml)" ...
```

This eliminates the need for agents to read files from disk, reducing latency and ensuring all agents receive identical context.

### Dynamic File Injection

The `build_prompt_system_append()` method scans for files matching story IDs and generates XML injection content:

```xml
<file_injections>
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    <!-- frozen project context -->
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-2a-1-discovery-story.md">
    <!-- discovery findings -->
  </file>
</file_injections>
```

Different phases receive different file sets:
- **create-story**: Project context only
- **dev-story**: Project context + story file + discovery + tech-spec (if exists)
- **code-review**: Project context + story file + discovery + tech-spec

### Custom Commands Structure

Each command in `commands/` follows this structure:

| File | Purpose |
|------|---------|
| `workflow.yaml` | Command metadata, variables, paths |
| `instructions.xml` | Agent instructions in XML format |
| `template.md` | Output file template (if applicable) |
| `checklist.md` | Validation checklist for review phases |

Commands are invoked via Claude CLI with the command name:
```bash
claude --command sprint-create-story --prompt-system-append "..."
```

### sprint-log.sh - Subagent Logging

Direct logging script for subagents to log structured events to SQLite:

```bash
sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing"}'
```

**Required fields:** `epic_id`, `story_id`, `command`, `task_id`, `status`
**Optional fields:** `message`, `metrics`, `attempt`

Events are written directly to the SQLite database (no intermediate log file).

## Key Components

### 1. `instructions.md` - Workflow Definition

This file defines the complete workflow logic in a structured format:
- Step-by-step orchestration flow
- Conditions and decision points
- Parallelization rules
- Error handling patterns

**This is the source of truth for workflow behavior.** The Python orchestrator implements this logic deterministically.

### 2. `task-taxonomy.yaml` - Logging Schema

Defines valid task IDs for each command phase:
- `create-story`: setup, analyze, generate, write, validate
- `dev-story`: setup, implement, tests, lint, validate
- `code-review`: setup, analyze, fix, test, validate
- etc.

Used by subagents when logging to `sprint.log`.

### 3. `commands/` - v3 Custom Commands

Each folder contains a complete command definition:
- `sprint-create-story` - Creates story files from epic requirements
- `sprint-create-story-discovery` - Explores codebase for implementation context
- `sprint-story-review` - Reviews story quality and completeness
- `sprint-create-tech-spec` - Creates technical specifications
- `sprint-tech-spec-review` - Reviews tech-spec quality
- `sprint-dev-story` - Implements story code
- `sprint-code-review` - Reviews and fixes code issues
- `sprint-commit` - Commits completed work

The orchestrator invokes these via Claude CLI with `--command` flag and injects context via `--prompt-system-append`.

### 4. `dashboard/` - Automated Orchestrator

The dashboard is split into `server/` (Python backend) and `frontend/` (HTML/CSS/JS):

**Server** (`server/` package):
- Builds prompt system append content via `build_prompt_system_append()`
- Spawns Claude CLI subagents with injected context
- Tracks state in SQLite database
- Provides real-time WebSocket updates
- Exposes Settings API with 9 configurable parameters

**Frontend** (`frontend/`):
- Modular JavaScript architecture (9 modules)
- Settings tab for runtime configuration
- Real-time WebSocket-based updates

See `dashboard/README.md` for detailed usage.

## Workflow Sequence

```
1. Project Context Check
   └── Missing: CREATE and WAIT
   └── Expired: REFRESH in background, continue
   └── Fresh: Skip

2. Story Selection
   └── Read sprint-status.yaml
   └── Find first non-done story
   └── Pair up to 2 stories from same epic

3. CREATE-STORY Phase (parallel)
   └── create-story agent (creates story file)
   └── create-story-discovery agent (explores codebase)
   └── Parse tech-spec decisions

4. STORY-REVIEW Phase
   └── review-1: blocking, default model
   └── review-2/3: background if critical issues found

5. CREATE-TECH-SPEC Phase (conditional)
   └── Only if tech-spec decision = REQUIRED

6. TECH-SPEC-REVIEW Phase
   └── Same pattern as story review

7. DEV + CODE-REVIEW Phase (per story)
   └── dev-story: implement code
   └── code-review loop: up to 10 attempts
       └── ZERO issues → done
       └── 3 reviews, no critical → done
       └── Same error 3x → blocked
       └── 10 attempts → blocked

8. BATCH-COMMIT Phase
   └── Archive artifacts
   └── Git commit

9. Cycle Control
   └── "all" mode: loop until done
   └── "fixed" mode: pause at max_cycles
```

## How to Modify

### To change workflow logic:
1. Edit `instructions.md` - defines WHAT happens
2. Update `dashboard/orchestrator.py` - implements HOW it happens
3. Both must stay in sync

### To change subagent behavior:
1. Edit the relevant command in `commands/` folder
2. Update `instructions.xml` for agent instructions
3. No orchestrator changes needed for instruction updates

### To add new task phases:
1. Add to `task-taxonomy.yaml`
2. Create new command folder in `commands/` with:
   - `workflow.yaml` - Command metadata
   - `instructions.xml` - Agent instructions
   - `template.md` - Output template (optional)
   - `checklist.md` - Validation checklist (optional)
3. Update `orchestrator.py` to invoke the new command

### To change logging/events:
1. Edit `dashboard/server/db.py` for database schema
2. Edit `dashboard/server/server.py` for WebSocket events
3. Edit `dashboard/frontend/js/*.js` for UI display

### To change settings:
1. Edit `dashboard/server/settings.py` to add/modify settings
2. Edit `dashboard/frontend/js/settings.js` for UI controls

## Running the Orchestrator

### Via Dashboard (Recommended)

```bash
cd dashboard
pip install -r server/requirements.txt
python -m server.server
```

Open `http://localhost:8080` and use the Sprint Run tab.

### Via BMAD Command

```bash
/bmad:bmm:workflows:sprint-runner
```

This invokes the LLM-based orchestrator (reads instructions.md directly).

## v3 Key Methods

### `build_prompt_system_append()`

Builds the XML injection content for a subagent:

```python
def build_prompt_system_append(
    self,
    command_name: str,
    story_keys: list[str],
    include_project_context: bool = True,
    include_discovery: bool = False,
    include_tech_spec: bool = False,
    additional_files: Optional[list[str]] = None,
) -> str
```

- Scans for files matching story IDs
- Deduplicates file list
- Generates XML with file contents
- Enforces 150KB size limit

### `copy_project_context()`

Freezes project context for the batch:

```python
def copy_project_context(self) -> bool
```

Copies `project-context.md` to `sprint-project-context.md` so all agents in a batch receive identical, frozen context.

### `cleanup_batch_files()`

Archives completed story artifacts:

```python
def cleanup_batch_files(self, story_keys: list[str]) -> int
```

Moves files matching story keys from `implementation-artifacts/` to `archived-artifacts/`.

## File Naming Conventions

v3 uses consistent prefixes for all generated files:

| Pattern | Purpose |
|---------|---------|
| `sprint-{story_key}.md` | Story files (e.g., `sprint-2a-1.md`) |
| `sprint-{story_key}-discovery-story.md` | Discovery files (e.g., `sprint-2a-1-discovery-story.md`) |
| `sprint-tech-spec-{story_key}.md` | Tech specs (e.g., `sprint-tech-spec-2a-1.md`) |
| `sprint-project-context.md` | Frozen project context for batch |

## Data Files

| File | Location | Purpose |
|------|----------|---------|
| `sprint-status.yaml` | `_bmad-output/implementation-artifacts/` | Story status tracking |
| `sprint-runner.db` | `dashboard/server/` | SQLite state database |
| `sprint-*.md` | `_bmad-output/implementation-artifacts/` | Generated story/discovery files |
| `sprint-tech-spec-*.md` | `_bmad-output/implementation-artifacts/` | Generated tech specs |
| `sprint-project-context.md` | `_bmad-output/planning-artifacts/` | Frozen project context |

## Integration Points

### External Dependencies
- Claude CLI (`claude` command)
- sprint-status.yaml (source of truth for story states)
- Epic files in planning-artifacts
- Project-context.md (codebase summary)

### Output
- Story files in implementation-artifacts
- Tech-spec files
- Git commits
- Event logs (CSV + SQLite)

## Testing

```bash
cd dashboard
python -m pytest server/test_*.py -v
```

Test suites:
- `test_db.py` - Database operations
- `test_orchestrator.py` - Orchestrator logic
- `test_server.py` - Server/WebSocket
- `test_integration.py` - Integration tests
- `test_parity.py` - Functional parity tests
