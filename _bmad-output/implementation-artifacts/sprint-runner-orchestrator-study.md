# Sprint Runner Orchestrator Study

## Purpose
Analyze the current orchestrator workflow from `instructions.md` to identify all events, actions, and conditions that can be automated via a Python/Node script with SQLite state management.

---

## Current Architecture Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `instructions.md` | `_bmad/bmm/workflows/4-implementation/sprint-runner/` | Orchestrator workflow logic |
| `task-taxonomy.yaml` | Same folder | Fixed task-id definitions for logging |
| `server.py` | `docs/` | Dashboard HTTP server |
| `dashboard.html` | `docs/` | Visual dashboard |
| `sprint-runner.csv` | `docs/` | Event log (CSV format) |
| `sprint-status.yaml` | `_bmad-output/implementation-artifacts/` | Source of truth for story states |

---

## Orchestrator Workflow Events/Actions (In Order)

### Step 0: Initialization

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `0a-check-context` | CONDITION | Run `project-context-should-refresh.sh` | Script calls shell command, checks exit code |
| `0a-refresh-context` | ACTION | Spawn subagent for `/generate-project-context` | Script spawns `claude -p --output-format stream-json` with workflow prompt |
| `0b-parse-batch-size` | ACTION | Parse user input for cycle count ("all", number, default=2) | Script reads from config or API parameter |

### Step 1: Story Selection

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `1-read-status` | ACTION | Read sprint-status.yaml | Script reads YAML file directly |
| `1-filter-stories` | ACTION | Filter to story keys only (exclude `epic-*`, `*-retrospective`) | Regex filter in script |
| `1-sort-stories` | ACTION | Sort numerically (1-1, 1-2, 2a-1, etc.) | Custom sort function |
| `1-find-next` | CONDITION | Find first non-done, non-blocked story | Script query |
| `1-pair-stories` | CONDITION | Check if second story same epic, pair if so | Script logic: extract epic prefix, compare |
| `1-all-done` | CONDITION | All stories done/blocked? | Script terminates loop |

### Step 2: Create-Story Phase (PARALLEL)

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `2-check-status` | CONDITION | status == backlog? | Script checks sprint-status.yaml value |
| `2-spawn-create-story` | ACTION | Spawn subagent with `create-story.md` prompt | **Child process 1**: `claude -p --output-format stream-json` |
| `2-spawn-discovery` | ACTION | Spawn subagent with `create-story-discovery.md` prompt | **Child process 2**: runs parallel |
| `2-wait-both` | SYNC | Wait for both child processes to complete | Script uses `Promise.all()` or `asyncio.gather()` |
| `2-inject-context` | ACTION | Run `project-context-injection.sh` | Script calls shell command per story |
| `2-parse-tech-spec-decision` | ACTION | Parse `[TECH-SPEC-DECISION: REQUIRED/SKIP]` from output | Regex on child stdout |

### Step 2b: Story Review (PARALLEL AFTER REVIEW-1)

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `2b-spawn-review-1` | ACTION | Spawn subagent for story-review (review_attempt=1) | Child process, default model |
| `2b-wait-review-1` | SYNC | Wait for completion | Script waits |
| `2b-check-critical` | CONDITION | Parse output for critical issues | Regex on stdout |
| `2b-spawn-background-chain` | ACTION (conditional) | If critical: spawn background review-2/3 chain | Fire-and-forget child process (Haiku model) |
| `2b-continue` | ACTION | Continue to next step immediately | Script proceeds |

### Step 3: Create Tech-Spec (CONDITIONAL)

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `3-check-needed` | CONDITION | tech_spec_needed == true? | Script variable check |
| `3-spawn-tech-spec` | ACTION | Spawn subagent with `create-tech-spec.md` | Child process |
| `3-wait` | SYNC | Wait for completion | Script waits |

### Step 3b: Tech-Spec Review (PARALLEL AFTER REVIEW-1)

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `3b-spawn-review-1` | ACTION | Spawn tech-spec-review (review_attempt=1) | Child process, default model |
| `3b-wait-review-1` | SYNC | Wait for completion | Script waits |
| `3b-check-critical` | CONDITION | Parse output for critical issues | Regex on stdout |
| `3b-spawn-background-chain` | ACTION (conditional) | If critical: spawn background review-2/3 | Fire-and-forget child process |
| `3b-continue` | ACTION | Continue to Step 4 | Script proceeds |

### Step 4: Dev + Code Review (SEQUENTIAL per story)

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `4-loop-stories` | LOOP | For each story in story_keys | Script for-loop |
| `4-spawn-dev-story` | ACTION | Spawn subagent with `dev-story.md` | Child process |
| `4-wait-dev` | SYNC | Wait for completion | Script waits |
| `4-init-review-loop` | ACTION | Set review_attempt=1, error_history=[] | Script variables |
| `4-spawn-code-review` | ACTION | Spawn subagent with `code-review.md` | Child process (Haiku for review_attempt >= 2) |
| `4-wait-review` | SYNC | Wait for completion | Script waits |
| `4-parse-issues` | ACTION | Parse issues and severity from output | Regex on stdout |
| `4-check-repeat-error` | CONDITION | Same error 3x consecutive? | Compare error_history entries |
| `4-mark-blocked` | ACTION (conditional) | Set story status to "blocked" | Script updates YAML |
| `4-check-zero-issues` | CONDITION | Zero issues? | Script checks |
| `4-mark-done` | ACTION (conditional) | Set story status to "done" | Script updates YAML |
| `4-check-3-no-critical` | CONDITION | review_attempt >= 3 AND no critical? | Script checks |
| `4-check-hard-limit` | CONDITION | review_attempt >= 10? | Script checks |
| `4-increment-review` | ACTION | Increment review_attempt | Script variable |

### Step 4c: Batch Commit

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `4c-collect-completed` | ACTION | Collect completed story IDs | Script filters |
| `4c-skip-if-empty` | CONDITION | No completed stories? Skip | Script checks |
| `4c-spawn-batch-commit` | ACTION | Spawn batch-commit workflow | Child process |
| `4c-wait` | SYNC | Wait for completion | Script waits |

### Step 5: Error Recovery

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `5-handle-error` | CONDITION | Any step failed? | Script try/catch |
| `5-re-read-status` | ACTION | Re-read sprint-status.yaml | Script reads YAML |
| `5-diagnose` | ACTION | Spawn sprint-status workflow | Child process |
| `5-mark-blocked-3-errors` | ACTION | 3 consecutive errors on same story = blocked | Script logic |

### Step 6: Cycle Tracking

| Event ID | Type | Description | Automation Approach |
|----------|------|-------------|---------------------|
| `6-check-batch-mode` | CONDITION | batch_mode == "all"? | Script variable |
| `6-increment-cycles` | ACTION | Increment cycles_completed | Script variable |
| `6-check-max-cycles` | CONDITION | cycles_completed >= max_cycles? | Script variable |
| `6-prompt-next-batch` | ACTION (conditional) | Ask for next batch count | Dashboard UI button / API |
| `6-loop-back` | ACTION | Go to Step 1 | Script loop |

---

## Task Taxonomy (Fixed IDs from task-taxonomy.yaml)

The script can trigger events based on these fixed task-ids when parsing child process output:

```yaml
commands:
  create-story:
    phases: [setup, analyze, generate, write, validate]
  story-discovery:
    phases: [setup, explore, write]
  story-review:
    phases: [setup, analyze, fix, validate]
  create-tech-spec:
    phases: [setup, discover, generate, write, validate]
  tech-spec-discovery:
    phases: [setup, explore, write]
  tech-spec-review:
    phases: [setup, analyze, fix, validate]
  dev-story:
    phases: [setup, implement, tests, lint, validate]
  code-review:
    phases: [setup, analyze, fix, test, validate]
```

---

## Parallelization Opportunities

| Phase | Current | Proposed Script Behavior |
|-------|---------|--------------------------|
| Create-story + Discovery | 2 parallel agents | 2 parallel child processes |
| Story Review-1 | Sequential | Sequential (blocks) |
| Story Review-2/3 | Background (fire-and-forget) | Fire-and-forget child processes |
| Tech-spec Review-2/3 | Background (fire-and-forget) | Fire-and-forget child processes |
| Dev per story | Sequential | Could parallelize across stories from DIFFERENT epics |
| Code-review per story | Sequential | Must remain sequential per story |

**NEW OPPORTUNITY**: With a dependency graph, we could:
- Run dev-story for story-2 while code-review runs for story-1
- Run tech-spec-review-2/3 in background while dev-story starts
- Run create-story for next epic while current epic finishes code-review

---

## Output Parsing Patterns

The script needs to parse child process JSON output for these patterns:

1. **Task progress logs**: CSV format in stdout
   ```
   timestamp,epicID,storyID,command,task-id,status,"message"
   ```

2. **Tech-spec decision**: `[TECH-SPEC-DECISION: REQUIRED]` or `[TECH-SPEC-DECISION: SKIP]`

3. **Critical issues indicator**: Parse for severity in output (need to standardize this)

4. **Zero issues indicator**: Look for `(issues:0)` in end messages

---

## SQLite Database Schema (Proposed)

```sql
-- Batch runs
CREATE TABLE batches (
  id INTEGER PRIMARY KEY,
  started_at INTEGER,      -- Unix timestamp
  ended_at INTEGER,        -- Unix timestamp
  max_cycles INTEGER,
  cycles_completed INTEGER,
  status TEXT              -- running, completed, stopped, error
);

-- Story states
CREATE TABLE stories (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_key TEXT,          -- e.g., "2a-1"
  epic_id TEXT,            -- e.g., "2a"
  status TEXT,             -- backlog, in-progress, review, blocked, done
  started_at INTEGER,
  ended_at INTEGER,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- Commands executed
CREATE TABLE commands (
  id INTEGER PRIMARY KEY,
  story_id INTEGER,
  command TEXT,            -- e.g., "create-story", "code-review-2"
  task_id TEXT,            -- e.g., "setup", "analyze"
  started_at INTEGER,
  ended_at INTEGER,
  status TEXT,             -- running, completed, failed
  output_summary TEXT,     -- Optional: key metrics extracted
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- Events log (mirrors CSV but in DB)
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_id INTEGER,
  command_id INTEGER,
  timestamp INTEGER,
  epic_id TEXT,
  story_key TEXT,
  command TEXT,
  task_id TEXT,
  status TEXT,             -- start, end
  message TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (command_id) REFERENCES commands(id)
);

-- Background tasks (fire-and-forget)
CREATE TABLE background_tasks (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_key TEXT,
  task_type TEXT,          -- story-review-chain, tech-spec-review-chain
  spawned_at INTEGER,
  completed_at INTEGER,
  status TEXT,             -- running, completed, failed
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);
```

---

## Dependency Graph System (Proposed)

Instead of sequential execution, the script maintains a dependency graph:

```yaml
# Example: priority-conditions.yaml
priorities:
  - name: create-story
    condition: "story.status == 'backlog'"
    parallel_with: ["story-discovery"]

  - name: story-review-1
    condition: "story.status == 'backlog' AND create-story.completed"

  - name: tech-spec
    condition: "story.tech_spec_decision == 'REQUIRED' AND story-review-1.completed"

  - name: tech-spec-review-1
    condition: "tech-spec.completed"

  - name: dev-story
    condition: "(tech-spec-review-1.completed) OR (story.tech_spec_decision == 'SKIP' AND story-review-1.completed)"
    parallel_across_epics: true

  - name: code-review
    condition: "dev-story.completed"
    loop_until: "issues == 0 OR (attempt >= 3 AND no_critical) OR attempt >= 10"
```

The script loop:
1. Load sprint-status.yaml + DB state
2. Evaluate all conditions against current state
3. Find all tasks that can run now (conditions met, not blocked)
4. Spawn children for all runnable tasks (respecting parallelization rules)
5. Wait for any child to complete
6. Update DB, re-evaluate conditions
7. Repeat until no tasks remain or stopped

---

## WebSocket Events for Dashboard

The script emits real-time events via WebSocket:

| Event | Payload |
|-------|---------|
| `batch:start` | `{ batch_id, max_cycles }` |
| `batch:end` | `{ batch_id, cycles_completed, status }` |
| `cycle:start` | `{ cycle_number, story_keys }` |
| `cycle:end` | `{ cycle_number, completed_stories }` |
| `command:start` | `{ story_key, command, task_id }` |
| `command:progress` | `{ story_key, command, task_id, message }` |
| `command:end` | `{ story_key, command, task_id, status, metrics }` |
| `story:status` | `{ story_key, old_status, new_status }` |
| `error` | `{ type, message, context }` |

---

## Recommended Technology Stack

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| Language | **Python** | Already using for server.py, simpler async with asyncio |
| Database | **SQLite** | Lightweight, single file, no setup |
| WebSocket | **websockets** library | Native async support |
| YAML parsing | **PyYAML** | Already standard |
| Process spawning | **asyncio.subprocess** | Native async subprocess management |
| HTTP server | **aiohttp** | Unified async server for HTTP + WebSocket |

Alternative: **Node.js** with `better-sqlite3`, `ws`, and native `child_process.spawn` would also work well.

---

## Migration Path

1. **Phase 1**: Create new `dashboard/` folder in sprint-runner command
2. **Phase 2**: Move server.py, dashboard.html, supporting files
3. **Phase 3**: Add SQLite database initialization
4. **Phase 4**: Implement orchestrator loop (replaces instructions.md interpretation)
5. **Phase 5**: Add WebSocket real-time events
6. **Phase 6**: Update dashboard with "Sprint Run" tab
7. **Phase 7**: Remove shell script dependencies, update prompts to output JSON markers
