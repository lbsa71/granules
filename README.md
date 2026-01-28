# GRANULES

Minimal multi-agent orchestrator. An MCP server holds work items (granules). Claude Code CLI instances act as workers that claim and complete granules.

## Design Principles

- **Self-building**: GRANULES bootstraps itself - the first worker plans, subsequent workers implement
- **Atomic claims**: Only one worker can claim a granule; claim fails if already taken
- **Summaries enable coordination**: Completed granules include summaries so workers can understand prior work

## Architecture
```
┌─────────────┐      ┌─────────────┐
│ Orchestrator│──────│ MCP Server  │
│   (loop)    │      │ (in-memory) │
└──────┬──────┘      └──────┬──────┘
       │                    │
       │ spawns             │ tools
       ▼                    ▼
┌─────────────┐      ┌─────────────┐
│  Worker W-1 │─────▶│  Worker W-2 │ ...
│ (claude cli)│      │ (claude cli)│
└─────────────┘      └─────────────┘
```

## Granule Schema

```typescript
interface Granule {
  id: string;           // "G-1", "G-2", auto-incremented
  class: GranuleClass;
  content: string;      // Task description
  state: GranuleState;
  claimedBy?: string;   // Worker ID, e.g., "W-1"
  claimedAt?: number;   // Unix timestamp ms
  createdAt: number;
  completedAt?: number;
  summary?: string;     // Completion summary, used for coordination
}

type GranuleClass =
  | "explore"      // Understand codebase/context
  | "plan"         // Design implementation approach
  | "implement"    // Write/modify code (artifacts)
  | "test"         // Write or run tests
  | "review"       // Critique another worker's output
  | "consolidate"; // Merge work from multiple workers

type GranuleState =
  | "unclaimed"    // Available for pickup
  | "claimed"      // Reserved by a worker
  | "completed";   // Finished
```

## MCP Tools

Server runs on `http://localhost:3000` using mcp-framework.

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `list_granules` | - | `Granule[]` | Get all granules |
| `create_granule` | `{class, content}` | `Granule` | Create new granule |
| `claim_granule` | `{granuleId, workerId}` | `{success, granule?}` | Atomic claim; fails if already claimed |
| `release_granule` | `{granuleId, workerId}` | `{success}` | Release claim |
| `complete_granule` | `{granuleId, workerId, summary?}` | `{success}` | Mark done |

## Orchestrator Behavior

```
1. Start MCP server on localhost:3000
2. Check for granules; if none, create bootstrap granule:
   - If -p flag provided: class="implement", content=prompt
   - Otherwise: class="plan", content="Read README.md and perform gap analysis..."
3. Main loop (every 5s):
   a. Fetch all granules
   b. Release stale claims (claimedAt > 30 minutes ago)
   c. For each unclaimed granule (up to MAX_WORKERS=3 active):
      - Spawn claude code cli with worker prompt
      - Worker ID: "W-{incrementing number}"
   d. Log active workers and granule states
```

## Worker Prompt Template

```
You are Worker {workerId}.
Your task granule:
- ID: {granule.id}
- Class: {granule.class}
- Content: {granule.content}

Connect to MCP server at http://localhost:3000

Instructions:
1. First, call claim_granule with your worker ID and granule ID
2. Do the work described in the content
3. You may call create_granule to spawn follow-up work
4. When done, call complete_granule with a brief summary

Available tools: list_granules, create_granule, claim_granule, release_granule, complete_granule
```

## Worker Spawning

Orchestrator spawns workers using:
```bash
claude --mcp-config ./mcp-config.json --output-format json -p "{prompt}" > logs/worker-{workerId}.json
```

The worker command defaults to the result of `which claude` (or `where claude` on Windows). Override with **`GRANULES_WORKER_CMD`** if needed:
- Full path: `GRANULES_WORKER_CMD=/opt/homebrew/bin/claude`
- npx: `GRANULES_WORKER_CMD="npx --yes @anthropic-ai/claude-code"`

MCP config file (`mcp-config.json`):
```json
{
  "mcpServers": {
    "granules": {
      "type": "http",
      "url": "http://localhost:3000"
    }
  }
}
```

## Worker Output

Each worker logs JSON output to: `logs/worker-{workerId}.json`

## Project Structure

```
granules/
├── src/
│   ├── index.ts         # Entry point, CLI args, starts orchestrator
│   ├── orchestrator.ts  # Main loop, worker spawning
│   ├── server.ts        # MCP server setup
│   ├── store.ts         # In-memory granule store
│   ├── types.ts         # Granule type definitions
│   ├── worker.ts        # Worker process spawning
│   ├── ui.ts            # Terminal UI manager
│   ├── session-log.ts   # Session logging
│   ├── tools/           # MCP tool implementations
│   └── *.test.ts        # Test files
├── logs/                # Worker output logs
├── mcp-config.json      # MCP server config for workers
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── CLAUDE.md
```

## Running

### Local Development
```bash
npm install
npm start
```

## CLI Arguments

| Argument | Description |
|----------|-------------|
| `-p`, `--prompt` | Create an initial granule with the specified task instead of the default bootstrap granule |

### Examples

Start with a specific task:
```bash
npx @lbsa71/granules -p "Add dark mode support to the UI"
```

Start with default bootstrap behavior (gap analysis):
```bash
npx @lbsa71/granules
```

When using `-p`, the orchestrator creates an "implement" class granule with your prompt as the content, skipping the default "plan" granule that performs gap analysis.

## CI/CD

The package `@lbsa71/granules` is automatically published to npm on every push to `main`.

**Setup Requirements:**
- Add `NPM_TOKEN` secret to GitHub repository settings (Settings > Secrets > Actions)
- The token must have publish permissions for the `@lbsa71` scope

### Using npx (no installation required)
```bash
npx @lbsa71/granules
```

This will download and run the latest version of granules in your current directory. The orchestrator will:
- Start the MCP server on localhost:3000
- Create a bootstrap granule if none exist
- Spawn workers to complete granules
- Exit when an "Implemented" granule is created

