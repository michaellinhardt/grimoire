/**
 * settings.js - Settings page functionality
 * Dependencies: utils.js
 *
 * Settings are fetched/saved via API endpoints:
 * - GET /api/settings - Load server settings
 * - PUT /api/settings - Save server settings
 */

// ============================================================
// Settings Configuration
// ============================================================

const SETTINGS_CONFIG = {
    server_port: {
        id: 'settingServerPort',
        type: 'number',
        defaultValue: 8080,
        min: 1024,
        max: 65535,
        label: 'Server Port',
        hint: 'HTTP server port (requires restart)',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1024 || num > 65535) {
                return 'Port must be between 1024 and 65535';
            }
            return null;
        }
    },
    default_max_cycles: {
        id: 'settingDefaultMaxCycles',
        type: 'number',
        defaultValue: 2,
        min: 1,
        max: 999,
        label: 'Default Max Cycles',
        hint: 'Default number of batch cycles',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 999) {
                return 'Max cycles must be between 1 and 999';
            }
            return null;
        }
    },
    project_context_max_age_hours: {
        id: 'settingProjectContextMaxAge',
        type: 'number',
        defaultValue: 24,
        min: 1,
        max: 168,
        label: 'Project Context Max Age',
        hint: 'Context freshness in hours (1-168)',
        suffix: 'hours',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 168) {
                return 'Max age must be between 1 and 168 hours';
            }
            return null;
        }
    },
    injection_warning_kb: {
        id: 'settingInjectionWarningKb',
        type: 'number',
        defaultValue: 100,
        min: 50,
        max: 200,
        label: 'Injection Warning Threshold',
        hint: 'Warn if injection exceeds this size (50-200)',
        suffix: 'KB',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 50 || num > 200) {
                return 'Warning threshold must be between 50 and 200 KB';
            }
            return null;
        }
    },
    injection_error_kb: {
        id: 'settingInjectionErrorKb',
        type: 'number',
        defaultValue: 150,
        min: 100,
        max: 300,
        label: 'Injection Error Threshold',
        hint: 'Error if injection exceeds this size (100-300)',
        suffix: 'KB',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 100 || num > 300) {
                return 'Error threshold must be between 100 and 300 KB';
            }
            return null;
        }
    },
    websocket_heartbeat_seconds: {
        id: 'settingWsHeartbeat',
        type: 'number',
        defaultValue: 30,
        min: 10,
        max: 120,
        label: 'WebSocket Heartbeat',
        hint: 'Heartbeat interval (10-120)',
        suffix: 'seconds',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 10 || num > 120) {
                return 'Heartbeat must be between 10 and 120 seconds';
            }
            return null;
        }
    },
    max_code_review_attempts: {
        id: 'settingMaxCodeReviewAttempts',
        type: 'number',
        defaultValue: 10,
        min: 1,
        max: 20,
        label: 'Max Code Review Attempts',
        hint: 'Maximum code review iterations (1-20)',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 20) {
                return 'Max attempts must be between 1 and 20';
            }
            return null;
        }
    },
    haiku_after_review: {
        id: 'settingHaikuAfterReview',
        type: 'number',
        defaultValue: 2,
        min: 1,
        max: 10,
        label: 'Switch to Haiku After',
        hint: 'Switch to Haiku model after N reviews (1-10)',
        suffix: 'reviews',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 10) {
                return 'Value must be between 1 and 10';
            }
            return null;
        }
    },
    default_batch_list_limit: {
        id: 'settingDefaultBatchListLimit',
        type: 'number',
        defaultValue: 20,
        min: 10,
        max: 100,
        label: 'Default Batch List Limit',
        hint: 'Default pagination limit (10-100)',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 10 || num > 100) {
                return 'Limit must be between 10 and 100';
            }
            return null;
        }
    }
};

// ============================================================
// Settings State
// ============================================================

let settingsState = {
    isDirty: false,
    isLoading: false,
    validationErrors: {},
    currentSettings: {}
};

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch settings from server API
 * @returns {Promise<Object>} - Settings object
 */
async function fetchSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        throw error;
    }
}

/**
 * Save settings to server API
 * @param {Object} settings - Settings to save
 * @returns {Promise<Object>} - Updated settings from server
 */
async function saveSettingsToServer(settings) {
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}

// ============================================================
// Settings Functions
// ============================================================

/**
 * Load settings from API and populate form
 */
async function loadSettings() {
    settingsState.isLoading = true;
    updateSettingsStatus('Loading settings...', false);

    try {
        const serverSettings = await fetchSettings();
        settingsState.currentSettings = serverSettings;

        // Populate form fields
        for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
            const el = document.getElementById(config.id);
            if (!el) continue;

            // Use server value if available, otherwise default
            const value = serverSettings[key] !== undefined
                ? serverSettings[key]
                : config.defaultValue;
            el.value = value;
        }

        settingsState.isDirty = false;
        settingsState.isLoading = false;
        updateSettingsStatus('');
    } catch (error) {
        settingsState.isLoading = false;
        updateSettingsStatus(`Failed to load settings: ${error.message}`, true);

        // Fall back to defaults on error
        for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
            const el = document.getElementById(config.id);
            if (el) {
                el.value = config.defaultValue;
            }
        }
    }
}

/**
 * Save settings via API
 * @returns {Promise<boolean>} - True if save successful
 */
async function saveSettings() {
    // Validate all settings first
    const errors = validateAllSettings();
    if (Object.keys(errors).length > 0) {
        updateSettingsStatus('Please fix validation errors', true);
        return false;
    }

    // Build settings object from form
    const settings = {};
    for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
        const el = document.getElementById(config.id);
        if (!el) continue;

        // Parse as integer since all settings are numbers
        settings[key] = parseInt(el.value, 10);
    }

    updateSettingsStatus('Saving settings...', false);

    try {
        const savedSettings = await saveSettingsToServer(settings);
        settingsState.currentSettings = savedSettings;
        settingsState.isDirty = false;
        updateSettingsStatus('Settings saved successfully', false);
        return true;
    } catch (error) {
        updateSettingsStatus(`Failed to save: ${error.message}`, true);
        return false;
    }
}

/**
 * Reset settings to defaults and save to server
 */
async function resetSettings() {
    // Build defaults object
    const defaults = {};
    for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
        defaults[key] = config.defaultValue;

        // Update form field
        const el = document.getElementById(config.id);
        if (el) {
            el.value = config.defaultValue;
        }

        // Clear validation error
        clearValidationError(config.id);
    }

    settingsState.validationErrors = {};
    updateSettingsStatus('Resetting to defaults...', false);

    try {
        const savedSettings = await saveSettingsToServer(defaults);
        settingsState.currentSettings = savedSettings;
        settingsState.isDirty = false;
        updateSettingsStatus('Settings reset to defaults', false);
    } catch (error) {
        updateSettingsStatus(`Failed to reset: ${error.message}`, true);
    }
}

/**
 * Validate all settings
 * @returns {Object} - Map of field names to error messages
 */
function validateAllSettings() {
    const errors = {};

    for (const [name, config] of Object.entries(SETTINGS_CONFIG)) {
        const el = document.getElementById(config.id);
        if (!el) continue;

        const error = config.validate(el.value);
        if (error) {
            errors[name] = error;
            showValidationError(config.id, error);
        } else {
            clearValidationError(config.id);
        }
    }

    settingsState.validationErrors = errors;
    return errors;
}

/**
 * Validate single setting
 * @param {string} name - Setting name
 * @returns {string|null} - Error message or null
 */
function validateSetting(name) {
    const config = SETTINGS_CONFIG[name];
    if (!config) return null;

    const el = document.getElementById(config.id);
    if (!el) return null;

    const error = config.validate(el.value);
    if (error) {
        showValidationError(config.id, error);
        settingsState.validationErrors[name] = error;
    } else {
        clearValidationError(config.id);
        delete settingsState.validationErrors[name];
    }

    return error;
}

/**
 * Show validation error for a field
 * @param {string} inputId - Input element ID
 * @param {string} message - Error message
 */
function showValidationError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(inputId + 'Error');

    if (input) {
        input.classList.add('invalid');
    }
    if (errorEl) {
        errorEl.textContent = message;
    }
}

/**
 * Clear validation error for a field
 * @param {string} inputId - Input element ID
 */
function clearValidationError(inputId) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(inputId + 'Error');

    if (input) {
        input.classList.remove('invalid');
    }
    if (errorEl) {
        errorEl.textContent = '';
    }
}

/**
 * Update settings status message
 * @param {string} message - Status message
 * @param {boolean} isError - Whether this is an error
 */
function updateSettingsStatus(message, isError = false) {
    const statusEl = document.getElementById('settingsStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'settings-status' + (isError ? ' error' : message ? ' success' : '');

        // Auto-clear success messages
        if (!isError && message && !message.includes('...')) {
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.textContent = '';
                    statusEl.className = 'settings-status';
                }
            }, 3000);
        }
    }
}

/**
 * Get setting value (from current loaded settings)
 * @param {string} name - Setting name
 * @returns {*} - Setting value or default
 */
function getSetting(name) {
    const config = SETTINGS_CONFIG[name];
    if (!config) return null;

    if (settingsState.currentSettings[name] !== undefined) {
        return settingsState.currentSettings[name];
    }

    return config.defaultValue;
}

// ============================================================
// Settings Event Listeners
// ============================================================

/**
 * Initialize settings event listeners
 * Called from main.js in DOMContentLoaded
 */
function initSettingsListeners() {
    // Save button
    const saveBtn = document.getElementById('settingsSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    // Reset button
    const resetBtn = document.getElementById('settingsResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                resetSettings();
            }
        });
    }

    // Input change handlers for validation and dirty tracking
    for (const [name, config] of Object.entries(SETTINGS_CONFIG)) {
        const el = document.getElementById(config.id);
        if (!el) continue;

        el.addEventListener('input', () => {
            settingsState.isDirty = true;
            validateSetting(name);
        });

        el.addEventListener('change', () => {
            validateSetting(name);
        });
    }

    // Load initial settings from API
    loadSettings();
}
