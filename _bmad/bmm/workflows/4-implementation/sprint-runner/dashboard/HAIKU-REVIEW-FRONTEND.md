# HAIKU-REVIEW-FRONTEND.md - Additional Issues

## Summary
6 architectural gaps: module initialization timing, CSS scoping, browser compatibility, and error state handling.

---

## NEW Issue 1: Module Loading Race Condition - DOM Elements Accessed Before Init
**Risk Level:** HIGH

`initBatchHistory()` is called during page load and references DOM elements like `#batchSidebar`. If `sidebar.js` loads as separate module, these calls execute before DOM is ready.

**Impact:** Batch sidebar fails to initialize on fast-loading browsers.

**Missing from plan:**
- `DOMContentLoaded` event wrapper for all initialization calls
- Error handling for null DOM element references

---

## NEW Issue 2: CSS Specificity Conflict - Tab Navigation
**Risk Level:** MEDIUM

CSS uses bare element selectors (e.g., `select { ... }` at line 1422). If settings.js adds `<select>` elements, they inherit these styles.

**Missing from plan:**
- CSS namespace strategy (e.g., `.settings-select` vs global `select`)

---

## NEW Issue 3: Missing Error State UI Components
**Risk Level:** MEDIUM

Settings tab only has `.settings-input.invalid` CSS class. Missing:
- HTML placeholder for inline error messages below invalid fields
- CSS for error message display
- JavaScript to render field-level error messages

---

## NEW Issue 4: Browser Compatibility - WebSocket Protocol
**Risk Level:** HIGH

Plan uses `ws://` (unencrypted). Modern browsers **block ws:// from https:// pages** (mixed content).

**Missing from plan:**
- No check for HTTPS → wss:// upgrade
- No feature detection for older browsers
- No error recovery if WebSocket fails

---

## NEW Issue 5: Module Global State Collision Risk
**Risk Level:** MEDIUM

`localStorage` used in 5+ modules without namespace prefix.

**Missing from plan:**
- Recommended localStorage key prefix: `grimoire-sprint-runner-{moduleName}-{key}`

---

## NEW Issue 6: Missing Error States - API Failures
**Risk Level:** MEDIUM

No error handling UI documented for:
- HTTP error codes (401, 403, 500, 503)
- Timeout handling
- Retry UI for failed saves
