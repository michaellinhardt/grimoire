# Implementation Plan: Dashboard.html Logging Changes

**Date:** 2026-01-23
**Target File:** `docs/dashboard.html`
**Reference:** `_bmad-output/research/change-report-dashboard-logging-2026-01-23.md`

---

## 1. Change Summary

| # | Change | Lines Affected |
|---|--------|----------------|
| 1 | Update file fetch from `orchestrator.md/csv` to `sprint-runner.csv` | 2785-2792, 2841-2849 |
| 2 | Remove `parseOrchestratorMarkdown()` function | 1654-1753 |
| 3 | Simplify `parseOrchestrator()` format detection | 1755-1769 |
| 4 | Update `parseOrchestratorCSV()` for milestone support | 1563-1652 |
| 5 | Update `renderActivityLog()` to display milestones | 2099-2122 |
| 6 | Add CSS styles for milestone display | Insert before line 1203 |
| 7 | Update console log messages | 1760-1764 |

---

## 2. Implementation Steps

### Step 1: Update File Fetch in `refreshViaFetch()` (Lines 2785-2793)

**Location:** Lines 2785-2793

**Before:**
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

**After:**
```javascript
                const csvResponse = await fetch('./sprint-runner.csv');
                if (csvResponse.ok) {
                    orchText = await csvResponse.text();
                    console.log('Loading sprint-runner.csv');
                }
```

---

### Step 2: Update File Fetch in `tryAutoLoad()` (Lines 2840-2849)

**Location:** Lines 2840-2849

**Before:**
```javascript
                let orchText = null;
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

**After:**
```javascript
                let orchText = null;
                const csvResponse = await fetch('./sprint-runner.csv');
                if (csvResponse.ok) {
                    orchText = await csvResponse.text();
                    console.log('Loading sprint-runner.csv');
                }
```

---

### Step 3: Remove `parseOrchestratorMarkdown()` Function (Lines 1654-1753)

**Location:** Lines 1654-1753 (entire function)

**Action:** Delete the entire function from line 1654 through line 1753.

**Code to Remove:**
```javascript
        // Parse orchestrator markdown log with estimated timestamps
        function parseOrchestratorMarkdown(text) {
            const activities = [];
            const storyBlocks = text.split(/^## Story:/m).slice(1);
            // ... entire function body ...
            return activities.reverse();
        }
```

---

### Step 4: Simplify `parseOrchestrator()` Function (Lines 1755-1769)

**Location:** Lines 1755-1769 (after markdown function removal, line numbers will shift)

**Before:**
```javascript
        // Main parser with format detection
        function parseOrchestrator(text) {
            const firstLine = text.trim().split('\n')[0];

            if (firstLine.match(/^\d+,/) || firstLine.includes('unix_timestamp')) {
                console.log('Detected CSV orchestrator format');
                return parseOrchestratorCSV(text);
            } else if (text.includes('## Story:')) {
                console.log('Detected Markdown orchestrator format (legacy)');
                return parseOrchestratorMarkdown(text);
            }

            console.warn('Unknown orchestrator format, attempting markdown parse');
            return parseOrchestratorMarkdown(text);
        }
```

**After:**
```javascript
        // CSV parser wrapper
        function parseOrchestrator(text) {
            if (!text || !text.trim()) {
                return [];
            }
            console.log('Parsing sprint-runner.csv');
            return parseOrchestratorCSV(text);
        }
```

---

### Step 5: Update `parseOrchestratorCSV()` Function (Lines 1563-1652)

**Location:** Lines 1563-1652

**Replace entire function with:**

```javascript
        // Parse orchestrator CSV log with command pairing and milestones
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
                    // Command started - create new pair with milestones array
                    activity.commandPairs.set(command, {
                        name: command,
                        startTs: ts,
                        step: activity.commandPairs.size + 1,
                        milestones: []  // Track intermediate logs
                    });
                    if (!activity.started) {
                        activity.started = formatTimestamp(ts);
                        activity.startTs = ts;
                    }
                } else if (result === 'end') {
                    // Command completed - close the pair and calculate duration
                    const pair = activity.commandPairs.get(command);
                    if (pair) {
                        pair.endTs = ts;
                        pair.durationSecs = ts - pair.startTs;
                        pair.durationFormatted = formatDuration(pair.durationSecs);

                        activity.steps.push({
                            step: pair.step,
                            command: command,
                            result: 'completed',
                            milestones: pair.milestones,  // Include milestones
                            duration: pair.durationFormatted,
                            durationSecs: pair.durationSecs,
                            startTs: pair.startTs,
                            endTs: pair.endTs
                        });
                    }

                    // Track story end timestamp
                    if (!activity.endTs || ts > activity.endTs) {
                        activity.endTs = ts;
                    }

                    // Check if this is the final step (code-review completed)
                    if (command.startsWith('code-review')) {
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

### Step 6: Update `renderActivityLog()` Steps Table (Lines 2099-2122)

**Location:** Lines 2099-2122 (inside `renderActivityLog` function)

**Before:**
```javascript
                const stepsTable = activity.steps.length > 0 ? `
                    <div class="activity-steps">
                        <table>
                            <thead>
                                <tr>
                                    <th>Step</th>
                                    <th>Command</th>
                                    <th>Result</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activity.steps.map(step => `
                                    <tr>
                                        <td>${escapeHtml(step.step)}</td>
                                        <td>${escapeHtml(step.command)}</td>
                                        <td class="step-result">${escapeHtml(step.result)}</td>
                                        <td class="step-duration">${escapeHtml(step.duration || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '';
```

**After:**
```javascript
                const stepsTable = activity.steps.length > 0 ? `
                    <div class="activity-steps">
                        <table>
                            <thead>
                                <tr>
                                    <th>Step</th>
                                    <th>Command</th>
                                    <th>Result</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activity.steps.map(step => `
                                    <tr>
                                        <td>${escapeHtml(String(step.step))}</td>
                                        <td>
                                            ${escapeHtml(step.command)}
                                            ${step.milestones && step.milestones.length > 0 ? `
                                                <div class="step-milestones">
                                                    ${step.milestones.map(m => `<span class="milestone">${escapeHtml(m.message)}</span>`).join('<span class="milestone-arrow">→</span>')}
                                                </div>
                                            ` : ''}
                                        </td>
                                        <td class="step-result">${escapeHtml(step.result)}</td>
                                        <td class="step-duration">${escapeHtml(step.duration || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '';
```

---

### Step 7: Add CSS Styles for Milestones (Insert Before Line 1203)

**Location:** Insert before `</style>` tag at line 1203

**CSS to Add:**
```css
        /* Milestone display styles */
        .step-milestones {
            margin-top: 6px;
            font-size: 0.75rem;
            line-height: 1.4;
        }

        .milestone {
            display: inline-block;
            background: #e8e8e5;
            color: #555;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin: 2px 0;
        }

        .milestone-arrow {
            color: #999;
            margin: 0 4px;
            font-size: 10px;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .milestone {
                background: #3a3a3a;
                color: #ccc;
            }
            .milestone-arrow {
                color: #666;
            }
        }
```

---

## 3. Updated parseOrchestratorCSV Function (Complete)

See Step 5 above for the complete updated function.

**Key Changes:**
1. Added `milestones: []` array to command pairs
2. Added `else if (result === 'end')` branch to handle explicit end markers
3. Added `else` branch to capture intermediate milestones
4. Updated step object to include `milestones` array
5. Changed completion check from `result === 'success'` to checking `command.startsWith('code-review')` with `result === 'end'`

---

## 4. Updated Activity Rendering (Complete)

See Step 6 above for the complete updated rendering code.

**Key Changes:**
1. Added conditional milestone display under each command
2. Used arrow separators between milestones
3. Applied CSS classes for styling

---

## 5. CSS Additions (Complete)

See Step 7 above for the complete CSS additions.

**Key Styles:**
- `.step-milestones` - Container for milestone badges
- `.milestone` - Individual milestone badge/chip
- `.milestone-arrow` - Arrow separator between milestones
- Dark mode support included

---

## 6. Code to Remove

### Function to Remove: `parseOrchestratorMarkdown` (Lines 1654-1753)

**Reason:** No longer supporting legacy markdown format

```javascript
// DELETE: Lines 1654-1753
function parseOrchestratorMarkdown(text) {
    // ... entire function (100 lines)
}
```

### Format Detection Logic to Remove (in `parseOrchestrator`)

**Reason:** Only CSV format supported

```javascript
// DELETE: These branches in parseOrchestrator
} else if (text.includes('## Story:')) {
    console.log('Detected Markdown orchestrator format (legacy)');
    return parseOrchestratorMarkdown(text);
}

console.warn('Unknown orchestrator format, attempting markdown parse');
return parseOrchestratorMarkdown(text);
```

### Fallback Fetch Logic to Remove

**Location:** Lines 2785-2792 and 2840-2849

```javascript
// DELETE: Fallback to orchestrator.md and orchestrator.csv
const orchMdResponse = await fetch('./orchestrator.md');
if (orchMdResponse.ok) {
    orchText = await orchMdResponse.text();
} else {
    const orchCsvResponse = await fetch('./orchestrator.csv');
    // ...
}
```

---

## 7. Testing Checklist

### Pre-Implementation
- [ ] Backup `docs/dashboard.html`
- [ ] Create test `sprint-runner.csv` file with new format

### File Loading
- [ ] Dashboard loads `./sprint-runner.csv` successfully
- [ ] Console shows "Parsing sprint-runner.csv" message
- [ ] No errors when `sprint-runner.csv` doesn't exist (graceful handling)
- [ ] Auto-refresh (5s interval) continues to work

### CSV Parser
- [ ] `start` entries create new command pairs
- [ ] Intermediate entries (not `start` or `end`) are captured as milestones
- [ ] `end` entries close command pairs and calculate duration
- [ ] Duration calculated correctly: `endTs - startTs`
- [ ] Multiple commands per story tracked separately
- [ ] Story completion detected when `code-review` command ends

### Milestone Display
- [ ] Milestones appear under command name in Activity tab
- [ ] Milestones separated by arrows (→)
- [ ] Milestones styled as small badges/chips
- [ ] Empty milestones array doesn't show milestone div

### Visual Verification
- [ ] Activity log displays correctly
- [ ] Step numbers sequential
- [ ] Durations formatted correctly (e.g., "45m 32s")
- [ ] Timeline view still works with new data structure

### Test CSV Format
```csv
unix_timestamp,epicId,storyId,command,result
1737650000,2a,2a-2-session-list-component,dev-story,start
1737650100,2a,2a-2-session-list-component,dev-story,tests-written
1737650500,2a,2a-2-session-list-component,dev-story,implementation-complete
1737650800,2a,2a-2-session-list-component,dev-story,validation-passed
1737651000,2a,2a-2-session-list-component,dev-story,end
1737651100,2a,2a-2-session-list-component,code-review,start
1737651500,2a,2a-2-session-list-component,code-review,issues-found
1737651800,2a,2a-2-session-list-component,code-review,end
```

**Expected Display:**
```
Step 1: dev-story [16m 40s]
  tests-written → implementation-complete → validation-passed

Step 2: code-review [11m 40s]
  issues-found
```

---

## 8. Implementation Order

1. **Add CSS styles** (Step 7) - No dependencies
2. **Update parseOrchestratorCSV()** (Step 5) - Core logic change
3. **Remove parseOrchestratorMarkdown()** (Step 3) - Cleanup
4. **Simplify parseOrchestrator()** (Step 4) - Cleanup
5. **Update renderActivityLog()** (Step 6) - UI change
6. **Update fetch in refreshViaFetch()** (Step 1) - File location
7. **Update fetch in tryAutoLoad()** (Step 2) - File location
8. **Test all changes** (Section 7)

---

## 9. Rollback Plan

If issues occur, revert to previous version:
```bash
git checkout HEAD -- docs/dashboard.html
```

Or restore from backup created in pre-implementation step.
