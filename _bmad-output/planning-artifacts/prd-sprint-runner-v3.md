---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - '_bmad-output/implementation-artifacts/sprint-runner-v3-context.md'
  - '_bmad-output/implementation-artifacts/sprint-runner-v3-research.md'
documentCounts:
  briefs: 0
  research: 2
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
---

# Product Requirements Document - Sprint Runner v3 Optimization

**Author:** Teazyou
**Date:** 2026-01-24

## Executive Summary

Sprint Runner v3 is a comprehensive optimization of the BMAD sprint-runner workflow orchestration system. This optimization moves setup work from subagents to the Python orchestrator, using Claude CLI's `--prompt-system-append` flag to inject pre-computed context at agent spawn time.

**The Core Problem:**
Currently, sprint-runner subagents waste significant tokens and time on repetitive initialization tasks. Each agent must independently read and parse BMAD command files, discover project-context.md, find discovery files, and execute setup steps that could be pre-computed. This causes wasted tokens on redundant operations, inconsistent context loading across agents, slower execution times, and potential for agents to miss or misread critical context.

**Why This Matters:**
Sprint-runner orchestrates complex multi-agent workflows where efficiency compounds. When each of 6-10 agents in a sprint batch saves 30 seconds on startup and avoids redundant file reads, the total time savings are substantial. More importantly, consistent context injection eliminates the risk of agents working with stale or incomplete information.

**This Phase Solves:**
A unified approach to context injection where the orchestrator handles all file discovery, deduplication, and injection. Subagents receive complete, verified context at spawn time and can immediately begin productive work. Custom sprint-* commands provide streamlined workflows optimized for orchestrator-driven execution.

### What Makes This Special

**Pre-computed Context Injection:** Every agent receives identical, verified context via `--prompt-system-append`. No more hoping agents correctly discover and read the right files.

**Dynamic Fresh Reads:** Despite being "pre-computed," every spawn reads files fresh at that exact moment. If project-context was refreshed in background between spawns, the next agent gets the updated version. No caching staleness.

**Isolated Sprint Commands:** 8 custom `sprint-*` commands duplicate BMAD workflows but remove setup steps. Original BMAD commands remain untouched - zero risk of breaking existing functionality.

**Direct Subagent Logging:** Subagents call the logging shell script directly with JSON arguments. No orchestrator stdout parsing required - cleaner architecture, more reliable logging.

**Success Gate:** Subagents start working immediately without setup overhead. Token usage measurably decreases. Execution time improves.

## Project Classification

**Technical Type:** Internal Tool Enhancement (Python Orchestrator + BMAD Workflow Commands)
**Domain:** Developer Productivity / AI Agent Orchestration
**Complexity:** Low-Medium (well-defined scope, existing patterns to follow)
**Project Context:** Brownfield - extending existing sprint-runner v2 system

### Architectural Principles

- **Duplication over Modification:** Create sprint-* variants rather than modifying original BMAD commands
- **Dynamic over Cached:** Always read files fresh at spawn time - no stale context
- **Orchestrator-Driven Setup:** Move all discovery and preparation to Python orchestrator
- **Direct Logging:** Subagents handle their own logging via shell script calls

## Success Criteria

### User Success

**The Efficiency Test:**
After running a sprint batch with v3, developers observe measurably faster execution and consistent output quality. No agent fails due to missing context or stale files.

**Success Indicators:**
| Indicator | Success State |
|-----------|---------------|
| Startup time | Subagents begin productive work immediately (no setup steps) |
| Context consistency | All agents in batch receive identical verified context |
| Token usage | Measurable reduction vs v2 (fewer redundant file reads) |
| Error rate | Zero failures due to missing or stale context |
| Logging reliability | All agent activities properly logged without parsing errors |

**The Escape Hatch Test:**
If any of these fail, fall back to v2:
- Agents still performing setup steps (commands not optimized)
- Inconsistent context between agents in same batch
- Higher token usage than v2
- Logging gaps or parsing failures

### Business Success

**Developer Productivity Adoption:**
| Timeframe | Success Indicator |
|-----------|-------------------|
| 1 week | Sprint-runner v3 used for all new sprint batches |
| 2 weeks | Zero fallbacks to v2 needed |
| 1 month | Measurable time savings documented |

**Core Test:** "Do sprints complete faster with better quality output?"

### Technical Success

**Performance Requirements:**
| Metric | Target |
|--------|--------|
| Agent startup | Immediate (no setup steps executed) |
| Context injection build | < 1 second per agent |
| File scanning | < 500ms for implementation-artifacts directory |
| Injection size | < 150KB per agent (warn if larger) |

**Reliability Requirements:**
- Zero context injection failures
- File deduplication always correct
- Cleanup moves all and only completed story artifacts
- Sprint-commit stages only related files

**Architecture Validation:**
- All 8 sprint-* commands functional
- Orchestrator methods integrated correctly
- Original BMAD commands completely unmodified
- Logging via shell script working end-to-end

### Measurable Outcomes

**v3 Complete When:**
- [ ] All 8 sprint-* commands created and functional
- [ ] Orchestrator `build_prompt_system_append()` method working
- [ ] Orchestrator `spawn_subagent()` accepts prompt_system_append parameter
- [ ] Orchestrator `cleanup_batch_files()` method working
- [ ] Orchestrator `copy_project_context()` method working
- [ ] All phase methods updated to use new commands
- [ ] End-to-end sprint batch completes successfully
- [ ] Token usage lower than v2

## Product Scope

### MVP - Phase 1: v3 Core Implementation

**Infrastructure:**
1. Update orchestrator.py with `build_prompt_system_append()` method
2. Update `spawn_subagent()` to accept prompt_system_append parameter
3. Implement `copy_project_context()` method
4. Implement `cleanup_batch_files()` method
5. Create commands/ directory structure

**Custom Commands:**
6. sprint-create-story - Create story files (context injected)
7. sprint-create-story-discovery - Generate discovery files (parallel)
8. sprint-story-review - Review stories (context injected)
9. sprint-create-tech-spec - Create tech specs (context injected)
10. sprint-tech-spec-review - Review tech specs (context injected)
11. sprint-dev-story - Implement stories (all context injected)
12. sprint-code-review - Adversarial review (context injected)
13. sprint-commit - Smart git commit by story IDs

**Orchestrator Integration:**
14. Update all phase methods to use sprint-* commands
15. Replace batch-commit with sprint-commit

### Growth Features (Post-MVP)

- Codebase mapping cache (24h expiry) for faster discovery
- Web research pre-computation for critical libraries
- Batch status injection for agent context awareness
- Task taxonomy injection for correct logging
- Error history tracking for faster code-review convergence

### Vision (Future)

- Context sharding for large file injection (>150KB)
- Model-specific prompt tuning (Haiku vs default vs Opus)
- Pattern library caching from git history
- Epic file indexing for batch-level optimization

## User Journeys

### Journey 1: Sprint Developer - "Faster Sprint Execution"

You start a sprint batch for epic 2a with 3 stories. In v2, you'd watch each agent spend 15-30 seconds reading project-context, scanning for discovery files, and parsing workflow instructions. Multiply that by 6 agents per story across 3 stories, and it adds up.

With v3, you run the same batch. The orchestrator scans implementation-artifacts once, builds the injection content in under a second, and spawns the first agent. The agent immediately starts creating the story - no "Reading project-context.md", no "Scanning for discovery files." It just works.

When code-review runs, it already has the story file, tech-spec, and all discovery context injected. It dives straight into adversarial review instead of spending tokens on discovery. The whole batch completes noticeably faster.

At commit time, sprint-commit analyzes git status, matches files to story IDs from the File List in each story, and commits only related changes. Unrelated work-in-progress stays uncommitted. Clean, isolated commits per story batch.

---

### Journey 2: Orchestrator Maintainer - "Clean Architecture"

You need to add a new sprint command variant. In v2, this meant copying prompts, hoping agents would correctly parse instructions, and debugging when context was inconsistent.

With v3, you:
1. Create a new folder in `commands/` with workflow.yaml and instructions.xml
2. Remove setup steps (context will be injected)
3. Add instruction referencing `<file_injections>` for context
4. Update orchestrator to call the new command with appropriate injection

The architecture is clean: orchestrator handles discovery and injection, commands handle execution. No ambiguity about who reads what files.

---

### Journey 3: Sprint Batch Monitor - "Reliable Logging"

You're monitoring a running sprint. In v2, the orchestrator tried to parse agent stdout for logging information, which was fragile and sometimes missed entries.

With v3, each agent calls the logging shell script directly:
```bash
_bmad/scripts/sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start"}'
```

The orchestrator doesn't parse stdout for logging. Logs are reliable, structured, and never missed. You see a clean timeline of every agent's activities in the sprint log.

---

### Journey Requirements Summary

| Journey | Capabilities Required |
|---------|----------------------|
| Sprint Developer | Context injection, spawn optimization, file scanning, cleanup automation |
| Orchestrator Maintainer | Command structure, injection API, phase method patterns |
| Sprint Batch Monitor | Direct logging calls, JSON structure, log file management |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Core Innovation: Prompt System Append for Context Injection**
Using Claude CLI's `--prompt-system-append` flag to inject pre-computed context is a novel approach to multi-agent orchestration. Rather than having each agent discover context independently, the orchestrator provides verified, deduplicated context at spawn time.

**Key Innovation Dimensions:**

| Dimension | Current State (v2) | v3 Innovation |
|-----------|-------------------|---------------|
| Context loading | Each agent reads files | Orchestrator injects all context |
| File discovery | Agents scan directories | Orchestrator scans once, injects |
| Consistency | Variable (agent-dependent) | Guaranteed (orchestrator-verified) |
| Token usage | High (redundant reads) | Lower (no redundant reads) |
| Startup time | Slow (setup steps) | Fast (immediate work) |

### Validation Approach

**Validation Criteria:**
- Token usage measurably lower than v2 for equivalent workload
- Execution time measurably faster for sprint batches
- Zero context-related failures in test batches
- All logging entries captured correctly

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Injection too large | Monitor size, warn >100KB, implement sharding if >150KB |
| Agents still read files | Explicit instruction "DO NOT read - content injected" |
| Multi-story logging confusion | Per-story sequential processing with individual logging |
| Git commit wrong files | Conservative matching from File List, investigation for ambiguous |

## Internal Tool Enhancement Specific Requirements

### Project-Type Overview

Sprint Runner v3 is an enhancement to an existing internal developer productivity tool. It optimizes the BMAD sprint-runner workflow orchestrator by moving setup work from subagents to the Python orchestrator.

### Technical Architecture Considerations

**File Structure:**
```
_bmad/bmm/workflows/4-implementation/sprint-runner/
├── commands/
│   ├── sprint-create-story/
│   │   ├── workflow.yaml
│   │   ├── instructions.xml
│   │   ├── template.md
│   │   └── checklist.md
│   ├── sprint-create-story-discovery/
│   ├── sprint-story-review/
│   ├── sprint-create-tech-spec/
│   ├── sprint-tech-spec-review/
│   ├── sprint-dev-story/
│   ├── sprint-code-review/
│   └── sprint-commit/
├── dashboard/
│   └── orchestrator.py
└── README.md
```

**Injection Format:**
```xml
<file_injections rule="DO NOT read these files - content already provided">
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    [content of project-context.md]
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-3a-1-discovery-story.md">
    [content of discovery file]
  </file>
</file_injections>

<workflow_instructions>
  [Pre-computed workflow instruction string]
</workflow_instructions>
```

**File Naming Convention:**
- `sprint-{story_key}.md` - Story files
- `sprint-{story_key}-discovery-story.md` - Discovery files
- `sprint-tech-spec-{story_key}.md` - Tech spec files
- `sprint-project-context.md` - Project context copy

### Implementation Considerations

**Orchestrator Changes Required:**
1. `build_prompt_system_append()` - Build injection content for an agent
2. `spawn_subagent()` - Accept and pass prompt_system_append parameter
3. `cleanup_batch_files()` - Move completed artifacts to archive
4. `copy_project_context()` - Copy to sprint-project-context.md at start

**Command Modifications per Variant:**
- REMOVE: Steps to read project-context.md (injected)
- REMOVE: Steps to run discover_inputs protocol (injected)
- REMOVE: Steps to update sprint-status (orchestrator handles)
- ADD: Instruction to use `<file_injections>` content
- ADD: Instruction for multi-story sequential processing
- ADD: Logging via direct shell script calls

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP
Build the complete v3 infrastructure and all 8 commands. Prove the optimization value before adding optional enhancements.

**Core Principle:** Ship the smallest thing that validates "measurably faster and more consistent."

### MVP Feature Set (Phase 1)

**Supported Journeys:**
- Sprint Developer - Full support
- Orchestrator Maintainer - Full support
- Sprint Batch Monitor - Full support

**Must-Have Capabilities:**

| Component | Purpose |
|-----------|---------|
| build_prompt_system_append() | Generate injection content for agents |
| Updated spawn_subagent() | Pass injection to Claude CLI |
| copy_project_context() | Create sprint-specific context copy |
| cleanup_batch_files() | Archive completed story artifacts |
| 8 sprint-* commands | Optimized workflow variants |
| Updated phase methods | Use new commands with injection |

**Explicitly Deferred:**
- Codebase mapping cache - Post-MVP
- Web research pre-computation - Post-MVP
- Batch status injection - Post-MVP
- Context sharding for large files - Post-MVP

### Post-MVP Features

**Phase 2 (Enhancement):**
- Codebase mapping cache with 24h expiry
- Batch status injection for agent awareness
- Task taxonomy injection
- Error history tracking for code-review

**Phase 3 (Optimization):**
- Context sharding for >150KB injections
- Model-specific prompt tuning
- Pattern library from git history
- Epic file indexing

### Risk Mitigation Strategy

**Technical Risks:**
| Risk | Mitigation |
|------|------------|
| Injection size too large | Monitor size, warn >100KB, sharding if >150KB |
| File path resolution | Explicit "DO NOT read" instruction with rule attribute |
| Deduplication logic | Set-based path tracking, test with overlapping patterns |

**Implementation Risks:**
| Risk | Mitigation |
|------|------------|
| Breaking existing BMAD | Duplicate, never modify - sprint-* are separate |
| Multi-story batching | Sequential processing with per-story logging |
| Background review blocks | Explicit run_in_background parameter |

**Validation Risks:**
| Risk | Mitigation |
|------|------------|
| No performance improvement | Compare v2 vs v3 token counts and timing |
| Inconsistent context | Verify injection content before spawn |

## Functional Requirements

### Orchestrator Infrastructure

- FR1: Orchestrator can build prompt-system-append content from story keys and command name
- FR2: Orchestrator can scan implementation-artifacts for files matching story IDs
- FR3: Orchestrator can deduplicate file list by path before injection
- FR4: Orchestrator can generate XML injection format with file paths and content
- FR5: Orchestrator can pass prompt-system-append to Claude CLI spawn
- FR6: Orchestrator can copy project-context.md to sprint-project-context.md
- FR7: Orchestrator can move completed story artifacts to archived-artifacts
- FR8: Orchestrator can read files fresh at each spawn (no caching between spawns)

### Custom Commands

- FR9: sprint-create-story can create story files using injected context
- FR10: sprint-create-story can output TECH-SPEC-DECISION marker for orchestrator parsing
- FR11: sprint-create-story-discovery can generate discovery files in parallel with create-story
- FR12: sprint-story-review can review stories using injected context
- FR13: sprint-story-review can output CRITICAL-ISSUES-FOUND marker for orchestrator parsing
- FR14: sprint-create-tech-spec can create tech specs using injected context
- FR15: sprint-tech-spec-review can review tech specs using injected context
- FR16: sprint-tech-spec-review can output CRITICAL-ISSUES-FOUND marker
- FR17: sprint-dev-story can implement stories using injected context
- FR18: sprint-code-review can perform adversarial review using injected context
- FR19: sprint-code-review can output HIGHEST SEVERITY marker for orchestrator parsing
- FR20: sprint-commit can analyze git status to find modified files
- FR21: sprint-commit can match files to story IDs from File List in story files
- FR22: sprint-commit can stage only files related to current batch stories
- FR23: sprint-commit can create commit with appropriate message format

### Multi-Story Processing

- FR24: Sprint commands can process comma-separated story_keys sequentially
- FR25: Sprint commands can log start/end for each story in multi-story batches
- FR26: Sprint commands can maintain isolation between stories in same batch

### Logging

- FR27: Subagents can call sprint-log.sh directly with JSON argument
- FR28: Subagents can log with task IDs: setup, analyze, generate, write, validate, implement, tests, lint
- FR29: Subagents can include attempt number in code-review logging

### Cleanup

- FR30: Orchestrator can identify all files with story ID in filename
- FR31: Orchestrator can move matched files to archived-artifacts directory
- FR32: Orchestrator can create archived-artifacts directory if not exists

### Deferred to Post-MVP

- Codebase mapping cache
- Web research pre-computation
- Context sharding for large injections
- Model-specific prompt tuning

## Non-Functional Requirements

### Performance

| Metric | Requirement | Rationale |
|--------|-------------|-----------|
| Injection build | < 1 second per agent | Fast enough to not impact perceived speed |
| File scanning | < 500ms for implementation-artifacts | Directory should be small |
| Total overhead | < 2 seconds per spawn | Must be faster than agent self-discovery |
| Token reduction | Measurable vs v2 | Primary optimization goal |

**Performance Gate:** If v3 is slower than v2 for any operation, investigate and fix.

### Reliability

**Data Integrity:**
- Zero injection content corruption
- All files in injection accurately reflect source content
- Deduplication never loses files (only eliminates duplicates)
- Cleanup never deletes files not matching story IDs

**Injection Quality:**
- XML format always valid and parseable
- File paths always absolute
- Rule attribute always present on file_injections element
- Workflow instructions always included

**Process Stability:**
- Orchestrator continues if single agent fails
- Cleanup waits for all agents to complete
- Background tasks don't block main flow

### Integration

**Claude CLI Integration:**
- Uses `--prompt-system-append` flag correctly
- Preserves original system prompt ordering
- Works with all supported model parameters
- Handles injection size limits gracefully

**BMAD Integration:**
- Sprint-* commands follow BMAD structure (workflow.yaml, instructions.xml)
- Original BMAD commands completely unmodified
- Sprint-runner README updated with v3 architecture

### Not Applicable (Explicitly Excluded)

**Scalability:** Single-user tool on local machine - no multi-user or cloud scale requirements.

**Security:** Local file operations only - no network data transmission beyond Claude API calls.

**Accessibility:** Internal developer tool - no broad accessibility requirements.
