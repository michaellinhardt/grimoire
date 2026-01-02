# Grimoire: Claude Code Spawn for Electron App

## Problem Statement

Running Claude Code in two separate contexts on the same machine:

1. **Electron App** - Requires dedicated configuration:
   - Specific MCP servers
   - Custom agents and commands
   - Isolated CLAUDE.md instructions
   - Independent settings

2. **Personal Use** - Standard terminal usage:
   - Personal MCP servers
   - Personal workflow configurations
   - Global `~/.claude` settings

**Constraint:** Both must coexist without configuration conflicts or interference.

---

## Solutions Evaluated

### Solution A: HOME Environment Override

Spawn Claude Code with a custom `HOME` directory, isolating all configuration.

- Isolation: Complete
- Complexity: Low
- Maintenance: Medium

### Solution B: Project-Level Isolation

Use a dedicated project folder with `.claude/` for Electron, rely on global config elsewhere.

- Isolation: Partial (project-level only)
- Complexity: Low
- Maintenance: Low

### Solution C: Docker Container

Run Electron's Claude Code instance inside Docker with volume mounts.

- Isolation: Complete
- Complexity: High
- Maintenance: High
- Performance: Degraded on macOS

### Solution D: Wrapper Script with Config Switch

Custom script that swaps configuration before launching Claude Code.

- Isolation: Complete
- Complexity: Medium
- Maintenance: Medium

---

## Selected Solution: HOME Environment Override

**Rationale:**

1. Complete isolation without Docker overhead
2. Native performance (no VM file I/O penalty)
3. Simple implementation in Electron/Node.js
4. Same Claude Code binary, different config
5. Easy to reset one environment without affecting the other

---

## Implementation

### Directory Structure

```
~/.claude/                              # Personal config (unchanged)
├── CLAUDE.md
├── settings.json
├── commands/
└── ...

~/.claude-electron/                     # Electron isolated HOME
└── .claude/                            # Claude Code will look here
    ├── CLAUDE.md                       # Electron-specific instructions
    ├── settings.json                   # Electron-specific MCPs
    ├── commands/                       # Electron-specific commands
    │   └── my-command.md
    └── settings.local.json             # Local overrides (optional)
```

### Initial Setup

Create the isolated environment:

```bash
# Create isolated home directory
mkdir -p ~/.claude-electron/.claude/commands

# Create Electron-specific CLAUDE.md
cat > ~/.claude-electron/.claude/CLAUDE.md << 'EOF'
# Electron App Claude Configuration

You are running inside an Electron application context.

## Behavior
- Follow app-specific workflows
- Use configured MCP servers for app features
- [Add your Electron-specific instructions here]
EOF

# Create Electron-specific settings
cat > ~/.claude-electron/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["/path/to/your/mcp-server.js"]
    }
  }
}
EOF
```

### Electron Integration

#### Spawning Claude Code with Isolated Config

```javascript
// electron/claude-spawner.js
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const ELECTRON_CLAUDE_HOME = path.join(os.homedir(), '.claude-electron');

function spawnClaude(args = [], options = {}) {
  const claudeProcess = spawn('claude', args, {
    env: {
      ...process.env,
      HOME: ELECTRON_CLAUDE_HOME,
    },
    cwd: options.cwd || process.cwd(),
    stdio: options.stdio || 'pipe',
  });

  return claudeProcess;
}

// Example: Run claude with a prompt
function runClaudePrompt(prompt, workingDir) {
  return new Promise((resolve, reject) => {
    const claude = spawnClaude(['-p', prompt], { cwd: workingDir });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    claude.on('error', reject);
  });
}

module.exports = { spawnClaude, runClaudePrompt };
```

#### Interactive Claude Session

```javascript
// electron/claude-interactive.js
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const ELECTRON_CLAUDE_HOME = path.join(os.homedir(), '.claude-electron');

function createInteractiveSession(workingDir) {
  const claude = spawn('claude', [], {
    env: {
      ...process.env,
      HOME: ELECTRON_CLAUDE_HOME,
    },
    cwd: workingDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    process: claude,

    send(input) {
      claude.stdin.write(input + '\n');
    },

    onOutput(callback) {
      claude.stdout.on('data', (data) => callback(data.toString()));
    },

    onError(callback) {
      claude.stderr.on('data', (data) => callback(data.toString()));
    },

    kill() {
      claude.kill();
    }
  };
}

module.exports = { createInteractiveSession };
```

#### With PTY for Full Terminal Emulation

```javascript
// electron/claude-pty.js
// Requires: npm install node-pty
const pty = require('node-pty');
const path = require('path');
const os = require('os');

const ELECTRON_CLAUDE_HOME = path.join(os.homedir(), '.claude-electron');

function createPtySession(workingDir, cols = 80, rows = 24) {
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';

  const ptyProcess = pty.spawn(shell, ['-c', 'claude'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env: {
      ...process.env,
      HOME: ELECTRON_CLAUDE_HOME,
    },
  });

  return ptyProcess;
}

module.exports = { createPtySession };
```

### Configuration Files Reference

#### settings.json Structure

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Read(~/projects/**)",
      "Write(~/projects/**)"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  },
  "mcpServers": {
    "your-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/server.js"],
      "env": {
        "API_KEY": "your-key"
      }
    },
    "another-server": {
      "command": "npx",
      "args": ["-y", "some-mcp-package"]
    }
  }
}
```

#### Custom Command Example

```markdown
<!-- ~/.claude-electron/.claude/commands/app-deploy.md -->
# Deploy Application

Deploy the current application to the configured environment.

## Steps
1. Run tests
2. Build production bundle
3. Deploy to server

## Instructions
- Always run tests before deploying
- Notify user of deployment status
```

### Verification

Test the isolation:

```bash
# Personal Claude - uses ~/.claude
claude --version

# Electron Claude - uses ~/.claude-electron/.claude
HOME=~/.claude-electron claude --version

# Verify different configs are loaded
HOME=~/.claude-electron claude -p "What CLAUDE.md instructions do you see?"
```

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Config not loading | Wrong path structure | Ensure `.claude/` exists inside the custom HOME |
| MCP servers not found | Relative paths | Use absolute paths in settings.json |
| Auth issues | Separate auth state | Run `HOME=~/.claude-electron claude` once to authenticate |
| Commands not available | Missing commands folder | Create `~/.claude-electron/.claude/commands/` |

---

## Summary

The HOME override approach provides complete isolation between Electron and personal Claude Code usage with:

- Zero performance penalty
- Single Claude Code installation
- Independent configurations
- Simple Electron integration
- Easy maintenance and updates
