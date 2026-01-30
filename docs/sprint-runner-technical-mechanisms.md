# Sprint Runner - Technical Mechanisms

## 1. System Prompt Injection

**What:** Injects pre-built context into subagent system prompts via `--prompt-system-append` CLI flag.

**How:**
- `build_prompt_system_append()` in orchestrator.py
- XML format: `<file_injections rule="DO NOT read these files - content already provided"><file path="...">content</file></file_injections>`
- Size validation: warning at 100KB, error at 150KB

**Steps Used:** All subagent spawns (create-story, discovery, review, dev, code-review, commit)

---

## 2. Parallel Task Spawning

**What:** Two independent subagent tasks run concurrently in single cycle.

**How:**
- Python `asyncio.gather()` and `asyncio.create_task()`
- Both tasks created, then `await asyncio.gather(task1, task2)`

**Steps Used:** Step 2 - create-story + discovery run in parallel

```python
create_task = asyncio.create_task(self.spawn_subagent(...))
discovery_task = asyncio.create_task(self.spawn_subagent(...))
await asyncio.gather(create_task, discovery_task)
```

---

## 3. Background Task Execution

**What:** Fire-and-forget tasks that don't block main loop.

**How:**
- `asyncio.create_task()` without await
- `is_background=True` parameter
- Tracked in `_background_tasks` list for graceful shutdown

**Steps Used:**
- Project context refresh (when expired)
- Review chains (review-2, review-3 when critical issues found)

---

## 4. Model Selection

**What:** Dynamic selection of Opus vs Haiku per subagent.

**How:**
- `--model` flag in Claude CLI args
- `model` parameter in `spawn_subagent()`
- Configurable via `haiku_after_review` setting (default: 2)

**Steps Used:**
- Code-review attempt 1: Opus (default)
- Code-review attempt 2+: Haiku
- Background review chains: Haiku

---

## 5. Context Injection Parameters

**What:** Controls which files get injected per phase.

**Parameters:**
- `include_project_context`: Always sprint-project-context.md
- `include_discovery`: Optional discovery-story.md files
- `include_tech_spec`: Optional tech-spec files

**Steps Used:**

| Phase | project_context | discovery | tech_spec |
|-------|-----------------|-----------|-----------|
| create-story | ✓ | | |
| discovery | ✓ | | |
| dev-story | ✓ | ✓ | ✓ |
| code-review | ✓ | ✓ | ✓ |

---

## 6. Output Parsing Patterns

**What:** Extract structured markers from subagent output.

**Patterns:**
- Tech-spec decision: `[TECH-SPEC-DECISION: REQUIRED|SKIP]`
- Severity: `HIGHEST SEVERITY: CRITICAL|HIGH|MEDIUM|LOW`
- Zero issues: `ZERO ISSUES`
- Critical issues: `[CRITICAL-ISSUES-FOUND: YES]`

**Steps Used:**
- Step 2: Parse tech-spec decisions after create-story
- Step 4: Parse severity in code-review loop
- Step 2b/3b: Check critical issues for background chain trigger

---

## 7. Sprint-Status YAML State Machine

**What:** Tracks story status transitions.

**States:**
```
backlog → ready-for-dev → in-progress → review → done
                                              ↘ blocked
```

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Steps Used:**
- Step 1: Read status for story selection
- Step 4: Update status after dev/review
- Step routing: Status determines which phases to skip

---

## 8. Story Pairing Algorithm

**What:** Groups 1-2 stories per cycle based on epic affinity.

**How:**
- Epic extraction via regex: `^(\d+[a-z]?(?:-[a-z]+)?)-\d+`
- Examples: "2a-1" → epic "2a", "5-sr-3" → epic "5-sr"
- Find first available story, look for second with same epic

**Steps Used:** Step 1 story selection

---

## 9. Error Pattern Comparison (3x Detection)

**What:** Detects when same error occurs 3 consecutive times.

**How:**
- `error_history` list tracks patterns per attempt
- At attempt >= 3: compare `history[-1] == history[-2] == history[-3]`
- If same 3x → mark story "blocked"

**Steps Used:** Step 4 code-review loop

---

## 10. Artifact Archiving

**What:** Moves completed story files to archive folder.

**How:**
- Source: `_bmad-output/implementation-artifacts/`
- Dest: `_bmad-output/archived-artifacts/`
- Pattern match: story key substring in filename
- Operation: `shutil.move()`

**Steps Used:** Step 4c batch-commit phase

---

## 11. YAML Frontmatter Variables

**What:** Configuration bindings in workflow.yaml files.

**Syntax:**
- `{variable}` for substitution
- `{config_source}:key` for nested config lookup

**Example:**
```yaml
config_source: '{project-root}/_bmad/bmm/config.yaml'
user_name: '{config_source}:user_name'
```

---

## 12. Prompt Templates

**What:** Variable interpolation in prompts.

**Pattern:** `{{variable_name}}`

**Variables:**
- `{{story_key}}` → "2a-1"
- `{{story_keys}}` → "2a-1,2a-2" (comma-separated batch)
- `{{epic_id}}` → "2a"
- `{{review_attempt}}` → "1", "2", "3"

---

## 13. Sequential Batch Processing

**What:** Single subagent processes multiple stories sequentially.

**How:**
- Stories passed as comma-separated string: "2a-1,2a-2"
- Subagent splits by comma, processes each in for-loop
- Each story gets individual start/end logging

**Contrast:** Parallel spawning (mechanism #2) is at orchestrator level; sequential processing is within single subagent.

---

## 14. Blocking vs Non-Blocking Waits

**What:** Controls whether orchestrator waits for subagent completion.

**Blocking (`wait=True`):**
- Reads NDJSON stream until EOF
- `await process.wait()`
- Returns result dict with stdout, exit_code
- Used by: create-story, review-1, dev-story, code-review

**Non-Blocking (`wait=False`, `is_background=True`):**
- Returns immediately with empty dict
- Main flow continues
- Used by: context refresh, review chains (2+)

---

## Additional: NDJSON Stream Parsing

**What:** Reads Claude CLI output in streaming JSON format.

**How:**
- `--output-format stream-json` flag
- Line-by-line JSON parsing
- AsyncGenerator yields events for real-time processing

---

## Additional: Git Status Capture

**What:** Captures git status for batch-commit context injection.

**How:**
- Runs `git status` subprocess
- XML-escapes output via `xml.sax.saxutils.escape()`
- Injects in `<git_status>` tags
- 10-second timeout
