/**
 * Grimoire Claude Spawner - Prototype
 *
 * Purpose: Spawn Claude Code with an isolated HOME directory so it uses
 * a separate configuration (MCP servers, CLAUDE.md, settings) from the
 * user's personal ~/.claude setup.
 *
 * === ISSUES ENCOUNTERED & SOLUTIONS ===
 *
 * ISSUE 1: Claude validates its installation path
 * - Claude Code checks that it exists at $HOME/.local/bin/claude
 * - When we override HOME, it looks in dot-claude/.local/bin/claude
 * - Error: "installMethod is native, but directory ... does not exist"
 * - SOLUTION: Create the directory structure and symlink the real binary
 *   mkdir -p dot-claude/.local/bin
 *   ln -s ~/.local/bin/claude dot-claude/.local/bin/claude
 *
 * ISSUE 2: Claude checks PATH includes its install directory
 * - Claude verifies $HOME/.local/bin is in PATH
 * - With custom HOME, it expects dot-claude/.local/bin in PATH
 * - Error: "Native installation exists but ~/.local/bin is not in your PATH"
 * - SOLUTION: Prepend dot-claude/.local/bin to PATH in spawn env
 *
 * === SETUP REQUIRED ===
 *
 * Before using this spawner, run:
 *   mkdir -p dot-claude/.local/bin
 *   ln -s ~/.local/bin/claude dot-claude/.local/bin/claude
 *   mkdir -p dot-claude/.claude  # for config files
 */

const { spawn } = require('child_process');
const path = require('path');

// Custom HOME directory - Claude will look for config at dot-claude/.claude/
const GRIMOIRE_CLAUDE_HOME = path.join(__dirname, '..', 'dot-claude');

function spawnClaude(args = [], options = {}) {
  const claudeProcess = spawn('claude', args, {
    env: {
      ...process.env,
      // Override HOME so Claude uses isolated config
      HOME: GRIMOIRE_CLAUDE_HOME,
      // Prepend fake HOME's .local/bin to PATH (fixes installation path check)
      PATH: `${path.join(GRIMOIRE_CLAUDE_HOME, '.local', 'bin')}:${process.env.PATH}`,
    },
    // Use caller's working directory, not the script's location
    cwd: options.cwd || process.cwd(),
    // 'inherit' makes Claude interactive and visible in terminal
    stdio: options.stdio || 'inherit',
  });

  return claudeProcess;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const claude = spawnClaude(args);

  claude.on('close', (code) => {
    process.exit(code);
  });

  claude.on('error', (err) => {
    console.error('Failed to start Claude:', err.message);
    process.exit(1);
  });
}

module.exports = { spawnClaude, GRIMOIRE_CLAUDE_HOME };
