# Sprint Runner - Automated Implementation Orchestrator

## Overview

Sprint Runner is a BMAD workflow that automates the implementation phase of software development. It orchestrates the creation, review, development, and code review of stories in a sprint.

## Architecture

```
sprint-runner/
├── README.md                 # This file - system overview
├── workflow.yaml             # BMAD workflow metadata
├── instructions.md           # Workflow logic definition (source of truth)
├── task-taxonomy.yaml        # Task ID definitions for logging
├── prompts/                  # Subagent prompts for each phase
│   ├── create-story.md
│   ├── create-story-discovery.md
│   ├── story-review.md
│   ├── create-tech-spec.md
│   ├── tech-spec-review.md
│   ├── dev-story.md
│   ├── code-review.md
│   └── background-review-chain.md
└── dashboard/                # Python automation + monitoring UI
    ├── README.md             # Dashboard-specific documentation
    ├── orchestrator.py       # Python implementation of instructions.md
    ├── server.py             # WebSocket server + HTTP API
    ├── db.py                 # SQLite state management
    ├── dashboard.html        # Real-time monitoring UI
    └── test_*.py             # Test suites
```

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

Used by subagents when logging to `sprint-runner.csv`.

### 3. `prompts/` - Subagent Instructions

Each file contains the prompt sent to Claude CLI for that phase:
- `create-story.md` - Creates story files from epic requirements
- `dev-story.md` - Implements story code
- `code-review.md` - Reviews and fixes code issues
- etc.

The orchestrator loads these, substitutes variables ({{story_key}}, {{review_attempt}}), and sends to Claude CLI.

### 4. `dashboard/` - Automated Orchestrator

Python implementation that:
- Reads `instructions.md` workflow logic
- Loads prompts from `prompts/` folder
- Spawns Claude CLI subagents
- Tracks state in SQLite database
- Provides real-time WebSocket updates
- Offers web-based control dashboard

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
1. Edit the relevant file in `prompts/`
2. No orchestrator changes needed

### To add new task phases:
1. Add to `task-taxonomy.yaml`
2. Update the relevant prompt file
3. Update `orchestrator.py` if new parsing needed

### To change logging/events:
1. Edit `dashboard/db.py` for database schema
2. Edit `dashboard/server.py` for WebSocket events
3. Edit `dashboard/dashboard.html` for UI display

## Running the Orchestrator

### Via Dashboard (Recommended)

```bash
cd dashboard
pip install -r requirements.txt
python server.py
```

Open `http://localhost:8080` and use the Sprint Run tab.

### Via BMAD Command

```bash
/bmad:bmm:workflows:sprint-runner
```

This invokes the LLM-based orchestrator (reads instructions.md directly).

## Data Files

| File | Location | Purpose |
|------|----------|---------|
| `sprint-status.yaml` | `_bmad-output/implementation-artifacts/` | Story status tracking |
| `sprint-runner.csv` | `docs/` | Event log (CSV format) |
| `sprint-runner.db` | `dashboard/` | SQLite state database |
| `story-*.md` | `_bmad-output/implementation-artifacts/` | Generated story files |
| `tech-spec-*.md` | `_bmad-output/implementation-artifacts/` | Generated tech specs |

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
python -m pytest test_*.py -v
```

232 tests covering:
- Database operations (66 tests)
- Orchestrator logic (68 tests)
- Server/WebSocket (50 tests)
- Integration (24 tests)
- Functional parity (24 tests)
