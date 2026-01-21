/**
 * Grimoire Hybrid Session Manager
 *
 * Demonstrates the hybrid approach:
 * - Normal messages: spawn `claude -p --output-format stream-json`
 * - Rewind: use SDK's resumeSessionAt
 * - Then back to -p mode
 */

const { spawn } = require('child_process');
const { query } = require('@anthropic-ai/claude-agent-sdk');
const path = require('path');
const readline = require('readline');

class GrimoireSession {
  constructor(options = {}) {
    this.sessionId = null;
    this.messageUuids = []; // Track user message UUIDs for rewind points
    this.cwd = options.cwd || process.cwd();
    this.configDir = options.configDir; // Optional CLAUDE_CONFIG_DIR isolation
    this.debug = options.debug || false;
  }

  /**
   * Build environment for spawning claude
   */
  _buildEnv() {
    const env = { ...process.env };
    if (this.configDir) {
      env.CLAUDE_CONFIG_DIR = this.configDir;
    }
    // Enable file checkpointing
    env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';
    return env;
  }

  /**
   * Send a message using -p mode with stream-json input/output
   * Returns an async generator that yields parsed messages
   */
  async *sendMessage(prompt) {
    const args = [
      '-p',
      '--input-format', 'stream-json',   // Required for replay-user-messages
      '--output-format', 'stream-json',
      '--verbose',
      '--replay-user-messages', // Get checkpoint UUIDs
      '--dangerously-skip-permissions',
    ];

    // Resume existing session if we have one
    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    // Note: prompt is sent via stdin, not as argument

    if (this.debug) {
      console.error('[DEBUG] Spawning claude with args:', args.join(' '));
    }

    const claude = spawn('claude', args, {
      env: this._buildEnv(),
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send prompt via stdin in stream-json format
    const userMessage = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: prompt,
      },
    });
    claude.stdin.write(userMessage + '\n');
    claude.stdin.end();

    // Read stdout line by line
    const rl = readline.createInterface({
      input: claude.stdout,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);

        // Track session ID
        if (msg.session_id && !this.sessionId) {
          this.sessionId = msg.session_id;
          if (this.debug) {
            console.error('[DEBUG] Session ID:', this.sessionId);
          }
        }

        // Track user message UUIDs for potential rewind points
        if (msg.type === 'user' && msg.uuid) {
          this.messageUuids.push({
            uuid: msg.uuid,
            timestamp: new Date().toISOString(),
          });
          if (this.debug) {
            console.error('[DEBUG] Checkpoint UUID:', msg.uuid);
          }
        }

        yield msg;
      } catch (e) {
        console.error('[ERROR] Failed to parse:', line);
      }
    }

    // Handle stderr
    let stderr = '';
    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for process to exit
    await new Promise((resolve, reject) => {
      claude.on('close', (code) => {
        if (code !== 0 && stderr) {
          console.error('[STDERR]', stderr);
        }
        resolve(code);
      });
      claude.on('error', reject);
    });
  }

  /**
   * Rewind to a specific message UUID using the SDK
   * This truncates conversation at that point and optionally rewinds files
   */
  async rewind(messageUuid, options = {}) {
    if (!this.sessionId) {
      throw new Error('No active session to rewind');
    }

    const { rewindFiles = true, fork = true } = options;

    console.log(`[REWIND] Rewinding to message: ${messageUuid}`);
    console.log(`[REWIND] Fork: ${fork}, Rewind files: ${rewindFiles}`);

    // Use SDK to resume at specific message
    // We need a non-empty prompt to avoid API errors
    const response = query({
      prompt: 'Continue.',
      options: {
        resume: this.sessionId,
        resumeSessionAt: messageUuid,
        forkSession: fork,
        enableFileCheckpointing: rewindFiles,
        cwd: this.cwd,
        permissionMode: 'bypassPermissions',
        maxTurns: 1, // Allow one turn to establish the rewind
      },
    });

    let newSessionId = null;

    try {
      for await (const msg of response) {
        if (msg.session_id) {
          newSessionId = msg.session_id;
        }

        // If we need to rewind files too
        if (rewindFiles && msg.type === 'system') {
          try {
            await response.rewindFiles(messageUuid);
            console.log('[REWIND] Files rewound successfully');
          } catch (e) {
            console.log('[REWIND] No file checkpoint at this message');
          }
        }
      }
    } catch (e) {
      console.error('[REWIND] Error:', e.message);
    }

    // Update session ID if we forked
    if (newSessionId && fork) {
      console.log(`[REWIND] Forked to new session: ${newSessionId}`);
      this.sessionId = newSessionId;

      // Truncate message history to rewind point
      const rewindIndex = this.messageUuids.findIndex(m => m.uuid === messageUuid);
      if (rewindIndex >= 0) {
        this.messageUuids = this.messageUuids.slice(0, rewindIndex + 1);
      }
    }

    return this.sessionId;
  }

  /**
   * Get list of rewind points (user messages)
   */
  getRewindPoints() {
    return [...this.messageUuids];
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Edit a message by rewinding to the checkpoint BEFORE it and sending new content
   *
   * @param {string} messageUuid - UUID of the message to edit (will be replaced)
   * @param {string} newContent - New content for the message
   * @param {object} options - Options for the edit
   * @returns {AsyncGenerator} - Generator yielding response messages
   */
  async *editMessage(messageUuid, newContent, options = {}) {
    const { rewindFiles = false } = options;

    // Find the checkpoint BEFORE the message we want to edit
    const messageIndex = this.messageUuids.findIndex(m => m.uuid === messageUuid);

    if (messageIndex < 0) {
      throw new Error(`Message ${messageUuid} not found in checkpoints`);
    }

    // If it's the first message, we can't edit it (no prior checkpoint)
    if (messageIndex === 0) {
      throw new Error('Cannot edit the first message - no prior checkpoint');
    }

    // Rewind to the message BEFORE the one we want to edit
    const priorCheckpoint = this.messageUuids[messageIndex - 1].uuid;
    console.log(`[EDIT] Rewinding to checkpoint before message: ${priorCheckpoint}`);

    await this.rewind(priorCheckpoint, { rewindFiles, fork: true });

    // Now send the new content as replacement
    console.log(`[EDIT] Sending edited message: "${newContent.substring(0, 50)}..."`);
    yield* this.sendMessage(newContent);
  }
}

module.exports = { GrimoireSession };
