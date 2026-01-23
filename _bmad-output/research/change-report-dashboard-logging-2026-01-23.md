# Change Report: Dashboard.html Logging Updates

**Date:** 2026-01-23
**Scope:** dashboard.html data extraction and display
**Related:** Sprint-runner logging changes (separate report)

---

## Summary

Update dashboard.html to:
1. Read from new file location `./sprint-runner.csv`
2. Remove legacy `orchestrator.md` support
3. Display intermediate action logs as steps in Activity tab
4. Calculate duration from "start" to "end" entries

---

## Change 1: Update File Fetch Location

### Current Behavior (lines 2785-2849)
```javascript
const orchMdResponse = await fetch('./orchestrator.md');
if (orchMdResponse.ok) {
    orchText = await orchMdResponse.text();
} else {
    const orchCsvResponse = await fetch('./orchestrator.csv');
    if (orchCsvResponse.ok) {
        orchText = await orchCsvResponse.text();
    }
}
```

### New Behavior
```javascript
const csvResponse = await fetch('./sprint-runner.csv');
if (csvResponse.ok) {
    orchText = await csvResponse.text();
}
```

### Files to Modify
- `docs/dashboard.html` - Update both `refreshData()` and initial load functions

---

## Change 2: Remove Legacy Markdown Parser

### Current
- `parseOrchestratorMarkdown()` function handles legacy markdown format
- `parseOrchestrator()` detects format and routes to appropriate parser

### New
- Remove `parseOrchestratorMarkdown()` function entirely
- Simplify `parseOrchestrator()` to only handle CSV
- Remove format detection logic

---

## Change 3: Update CSV Parser for New Log Structure

### Current CSV Format
```
timestamp,epicId,storyId,command,result
```
Where `result="start"` pairs with `result="[completion message]"`

### New CSV Format
```
timestamp,epicId,storyId,command,result
```
Where:
- `result="start"` - Command started (from orchestrator)
- `result="[milestone]"` - Intermediate action (from subagent)
- `result="end"` - Command completed (from subagent)

### Parser Updates

**Current pairing logic:**
- `start` opens a command
- Any non-`start` result closes the command and calculates duration

**New pairing logic:**
- `start` opens a command
- Intermediate results are stored as steps
- `end` closes the command and calculates duration

### Updated parseOrchestratorCSV Logic

```javascript
function parseOrchestratorCSV(text) {
    const lines = text.trim().split('\n');
    const startIndex = lines[0].includes('unix_timestamp') ? 1 : 0;
    const storyMap = new Map();

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 5) continue;

        const [timestamp, epicId, storyId, command, result] = parts;
        const ts = parseInt(timestamp, 10);

        if (!storyMap.has(storyId)) {
            storyMap.set(storyId, {
                storyId: storyId,
                epic: `epic-${epicId}`,
                started: null,
                completed: null,
                duration: '',
                steps: [],
                commandPairs: new Map(),
                startTs: null,
                endTs: null
            });
        }

        const activity = storyMap.get(storyId);

        if (result === 'start') {
            // Command started - create new pair
            activity.commandPairs.set(command, {
                name: command,
                startTs: ts,
                step: activity.commandPairs.size + 1,
                milestones: []  // NEW: Track intermediate logs
            });
            if (!activity.started) {
                activity.started = formatTimestamp(ts);
                activity.startTs = ts;
            }
        } else if (result === 'end') {
            // Command completed - close the pair
            const pair = activity.commandPairs.get(command);
            if (pair) {
                pair.endTs = ts;
                pair.durationSecs = ts - pair.startTs;
                pair.durationFormatted = formatDuration(pair.durationSecs);

                activity.steps.push({
                    step: pair.step,
                    command: command,
                    result: 'completed',
                    milestones: pair.milestones,  // NEW: Include milestones
                    duration: pair.durationFormatted,
                    durationSecs: pair.durationSecs,
                    startTs: pair.startTs,
                    endTs: pair.endTs
                });
            }

            // Track story end
            if (!activity.endTs || ts > activity.endTs) {
                activity.endTs = ts;
            }

            // Check if this is the final step (code-review completed)
            if (command.startsWith('code-review') && result === 'end') {
                // Check if no more code-review iterations follow
                activity.completed = formatTimestamp(ts);
            }
        } else {
            // Intermediate milestone log - add to current command
            const pair = activity.commandPairs.get(command);
            if (pair) {
                pair.milestones.push({
                    timestamp: ts,
                    message: result
                });
            }
        }
    }

    // Convert map to array and calculate totals
    const resultArr = Array.from(storyMap.values()).map(activity => {
        if (activity.startTs && activity.endTs) {
            activity.totalDurationSecs = activity.endTs - activity.startTs;
            activity.duration = formatDuration(activity.totalDurationSecs);
        } else {
            const totalSecs = activity.steps.reduce((sum, s) => sum + (s.durationSecs || 0), 0);
            activity.totalDurationSecs = totalSecs;
            activity.duration = formatDuration(totalSecs);
        }
        delete activity.commandPairs;
        return activity;
    });

    return resultArr.reverse();
}
```

---

## Change 4: Update Activity Tab Rendering

### Current
- Shows steps with: step number, command, result, duration

### New
- Shows steps with: step number, command, milestones (expandable), duration
- Milestones displayed as sub-items under each step

### Rendering Update

Find `renderActivityLog()` function and update to display milestones:

```javascript
// In step rendering, add milestone display
${step.milestones && step.milestones.length > 0 ? `
    <div class="step-milestones">
        ${step.milestones.map(m => `
            <span class="milestone">${escapeHtml(m.message)}</span>
        `).join(' → ')}
    </div>
` : ''}
```

### CSS Addition

```css
.step-milestones {
    font-size: 0.8rem;
    color: #666;
    margin-left: 1rem;
    padding: 0.25rem 0;
}

.milestone {
    background: #f0f0f0;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    margin-right: 0.25rem;
}
```

---

## Change 5: Update State Variable Names (Optional)

### Current
- `state.orchestratorData`

### New (Optional rename for clarity)
- `state.sprintRunnerData` or keep as `orchestratorData`

**Recommendation:** Keep as `orchestratorData` to minimize changes

---

## Change 6: Remove Fallback Logic

### Current
```javascript
const orchMdResponse = await fetch('./orchestrator.md');
if (orchMdResponse.ok) {
    orchText = await orchMdResponse.text();
} else {
    const orchCsvResponse = await fetch('./orchestrator.csv');
    // ...
}
```

### New
```javascript
const csvResponse = await fetch('./sprint-runner.csv');
if (csvResponse.ok) {
    orchText = await csvResponse.text();
}
```

---

## Change 7: Update Console Logs

### Current
```javascript
console.log('Detected CSV orchestrator format');
console.log('Detected Markdown orchestrator format (legacy)');
```

### New
```javascript
console.log('Loading sprint-runner.csv');
```

---

## Files to Modify Summary

| Location in dashboard.html | Change |
|---------------------------|--------|
| Lines ~2785-2792 | Update fetch to `./sprint-runner.csv` |
| Lines ~2838-2849 | Update fetch to `./sprint-runner.csv` |
| Lines ~1563-1652 | Update `parseOrchestratorCSV()` for new log structure |
| Lines ~1654-1768 | Remove `parseOrchestratorMarkdown()` function |
| Lines ~1757-1769 | Simplify `parseOrchestrator()` - CSV only |
| Activity rendering section | Add milestone display to steps |
| CSS section | Add `.step-milestones` and `.milestone` styles |

---

## Testing Checklist

1. [ ] Dashboard loads `./sprint-runner.csv` correctly
2. [ ] CSV parser handles `start` → milestones → `end` pattern
3. [ ] Milestones display under each step in Activity tab
4. [ ] Duration calculated correctly from start to end
5. [ ] Review iterations (e.g., `story-review-1`, `story-review-2`) display separately
6. [ ] No errors when file doesn't exist (graceful handling)
7. [ ] Timeline view shows correct step progression
