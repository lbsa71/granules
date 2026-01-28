# GRANULES Architecture

This document describes the system architecture, component interactions, data flow, and design decisions for the GRANULES multi-agent orchestrator.

## Overview

GRANULES is a minimal multi-agent orchestrator that coordinates work across isolated Claude Code CLI workers using the Model Context Protocol (MCP). It implements a **work-queue pattern** where discrete tasks (called "granules") are claimed by workers, executed in isolation, and completed with summaries for coordination. The system is designed to be self-building: the first worker plans, subsequent workers implement.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Entry Point                             │
│                        (src/index.ts)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Orchestrator                             │
│                    (src/orchestrator.ts)                        │
│  - Start MCP server                                             │
│  - Bootstrap initial granule                                    │
│  - Main loop: spawn workers, cleanup, check exit condition      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Worker W-1  │   │   Worker W-2  │   │   Worker W-3  │
│ (claude cli)  │   │ (claude cli)  │   │ (claude cli)  │
│ in worktree   │   │ in worktree   │   │ in worktree   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MCP Server (HTTP)                             │
│                    (src/server.ts)                              │
│           Tools: list, create, claim, release, complete         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Granule Store                                │
│                     (src/store.ts)                              │
│              In-memory Map<granuleId, Granule>                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. GranuleStore (`src/store.ts`)

The in-memory data store that holds all granules. This is the single source of truth for granule state.

**Responsibilities:**
- Store and retrieve granules
- Auto-increment granule IDs (G-1, G-2, etc.)
- Implement atomic claim/release operations
- Track granule lifecycle (unclaimed → claimed → completed)
- Release stale claims automatically

**Key Methods:**
- `createGranule(class, content)` - Creates a new granule with auto-incremented ID
- `claimGranule(granuleId, workerId)` - Atomically claims a granule; fails if already claimed or completed
- `releaseGranule(granuleId, workerId)` - Releases a claim (only the claiming worker can release)
- `completeGranule(granuleId, workerId, summary)` - Marks a granule as completed with optional summary
- `getStaleClaims(maxAgeMs)` - Identifies claims older than threshold
- `releaseStaleClaims(maxAgeMs)` - Automatically releases stale claims

**Key Design Decisions:**
- **In-memory only**: No persistence. This simplifies the implementation and fits the ephemeral nature of orchestration runs.
- **Atomic claims**: The `claimGranule` method checks and updates state atomically to prevent race conditions between workers.

### 2. MCP Server (`src/server.ts`)

HTTP server exposing the granule operations via the Model Context Protocol. Uses the `@modelcontextprotocol/sdk` library.

**Endpoints:**
- `POST /` or `POST /mcp` - MCP protocol endpoint
- `GET /health` - Health check

**MCP Tools (5 total):**

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `list_granules` | - | `Granule[]` | Get all granules |
| `create_granule` | `{class, content}` | `Granule` | Create new granule |
| `claim_granule` | `{granuleId, workerId}` | `{success, granule?}` | Atomic claim; fails if already claimed |
| `release_granule` | `{granuleId, workerId}` | `{success}` | Release claim |
| `complete_granule` | `{granuleId, workerId, summary?}` | `{success}` | Mark done |

**Transport:**
- **Protocol**: StreamableHTTP (stateless mode - each request is independent)
- **URL**: `http://localhost:3000`

**Key Design Decisions:**
- **Stateless HTTP transport**: Each request is independent; no session management required.
- **In-memory transport for testing**: Allows unit tests without spinning up HTTP servers.

### 3. Orchestrator (`src/orchestrator.ts`)

The main control loop that manages workers and monitors granules.

**Configuration Constants:**
```typescript
const MAX_WORKERS = 3;                        // Maximum concurrent workers
const LOOP_INTERVAL_MS = 5000;                // Check interval (5 seconds)
const STALE_CLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

**Responsibilities:**
- Start the MCP server
- Bootstrap with an initial "plan" granule if none exist
- Monitor granule states in a polling loop (every 5 seconds)
- Spawn workers for unclaimed granules (up to MAX_WORKERS=3)
- Release stale claims (claims older than 30 minutes)
- Detect exit condition (granule with class "Implemented" exists and no work in progress)
- Clean up worker logs on startup

**Lifecycle:**
1. Clean up old logs
2. Start MCP server on port 3000
3. Create bootstrap granule if store is empty
4. Enter main loop:
   - Release stale claims
   - Clean up completed worker processes
   - Check for exit condition
   - Spawn workers for unclaimed granules
   - Log state

**Active Worker Tracking:**
```typescript
Map<workerId, {
  workerId: string,        // "W-1", "W-2", etc.
  granuleId: string,       // "G-5"
  process: ChildProcess,   // Node child process
  startedAt: number        // Unix timestamp
}>
```

**Key Design Decisions:**
- **Polling-based**: Simpler than event-driven, adequate for the expected load.
- **Exit condition**: "Implemented" class granule signals completion; orchestrator waits for in-progress work to finish before exiting.
- **Worker limit**: MAX_WORKERS=3 prevents resource exhaustion.

### 4. Worker Spawner (`src/worker.ts`)

Spawns Claude CLI processes to execute work on granules.

**Responsibilities:**
- Generate worker prompts with task instructions
- Create isolated git worktrees for each worker
- Spawn Claude CLI with MCP configuration
- Stream and log worker output
- Clean up worktrees and branches on exit

**Worker Process:**
- Command: `claude --model opus --mcp-config ./mcp-config.json --dangerously-skip-permissions --verbose --output-format stream-json -p "{prompt}"`
- Override with `GRANULES_WORKER_CMD` environment variable
- Runs in the worker's isolated worktree directory

**Logging:**
- Streaming output: `logs/worker-{workerId}.log`
- Final metadata: `logs/worker-{workerId}.json`

**Script Generation:**
Workers use a shell script to avoid ARG_MAX limits:
1. Creates temporary shell script in `/tmp`
2. Spawns shell with script
3. Captures stdout/stderr to both log stream and JSON file
4. Cleans up script and worktree on exit

**Key Design Decisions:**
- **Git worktrees**: Provides true isolation for concurrent file modifications.
- **Shell script for spawning**: Avoids ARG_MAX limits by writing the prompt to a temp script.
- **GRANULES_WORKER_CMD**: Allows overriding the Claude CLI path.

### 5. Types (`src/types.ts`)

TypeScript type definitions for the granule data model.

**Granule Interface:**
```typescript
interface Granule {
  id: string;           // "G-1", "G-2", auto-incremented
  class: GranuleClass;  // Type of work
  content: string;      // Task description
  state: GranuleState;  // unclaimed | claimed | completed
  claimedBy?: string;   // Worker ID
  claimedAt?: number;   // Unix timestamp ms
  createdAt: number;    // Unix timestamp ms
  completedAt?: number; // Unix timestamp ms
  summary?: string;     // Completion summary
}
```

**Granule Classes:**
| Class | Purpose |
|-------|---------|
| `explore` | Understand codebase/context |
| `plan` | Design implementation approach |
| `implement` | Write/modify code (artifacts) |
| `test` | Write or run tests |
| `review` | Critique another worker's output |
| `consolidate` | Merge work from multiple workers |
| `Implemented` | **Exit condition**: orchestrator stops and outputs content as final report |

## Data Flow

### Startup Flow

```
main() ──► GranuleStore ──► Orchestrator.start()
                                  │
                                  ├── cleanupLogs()
                                  ├── startMcpHttpServer()
                                  ├── createBootstrapGranule() (if empty)
                                  └── tick() loop
```

### Main Loop (every 5 seconds)

```
tick()
   │
   ├─► Release stale claims (>30min old)
   ├─► Clean up completed workers
   ├─► Check exit condition
   │   └─► If Implemented granule exists AND no work in progress → EXIT
   └─► Spawn workers for unclaimed granules (up to MAX_WORKERS)
```

### Worker Lifecycle Flow

```
spawnWorkerForGranule()
         │
         ├── Create git worktree: .worktrees/worker-W-N-granule-G-N
         ├── Create branch: worker-W-N-granule-G-N
         ├── Generate worker prompt with instructions
         ├── Spawn Claude CLI in worktree directory
         │        │
         │        └──► Worker claims granule (via MCP)
         │             Worker does work
         │             Worker may create new granules (via MCP)
         │             Worker completes granule (via MCP)
         │
         └── On exit: cleanup worktree & branch
```

### MCP Tool Call Flow

```
Worker (Claude CLI) ──► HTTP POST /mcp
                              │
                              ├── StreamableHTTPServerTransport
                              │
                              └── McpServer.tool() handler
                                       │
                                       └── GranuleStore method
                                                │
                                                └── Response
```

## MCP Protocol Integration

The system uses MCP v1.0.0 from `@modelcontextprotocol/sdk`.

**Server Setup:**
- McpServer instance wraps the GranuleStore
- Tools are registered with Zod schemas for validation
- Transport: StreamableHTTP (stateless, supports multiple clients)

**Worker Connection:**
- Each worker passes `--mcp-config mcp-config.json` to Claude CLI
- Config file (`mcp-config.json`):
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

**Tool Registration Pattern:**
```typescript
server.tool(
  "tool_name",
  "Description",
  { /* Zod schema */ },
  async (params) => {
    const result = store.method(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

## Worker Isolation with Git Worktrees

Workers operate in **complete filesystem isolation** using git worktrees.

**Why Git Worktrees?**
- Isolated working directory per worker
- Independent git branches (`worker-W-1-granule-G-5`)
- Workers can make commits without affecting main branch
- Automatic cleanup after worker exits

**Worktree Lifecycle:**

1. **Creation** (orchestrator spawns worker):
   ```bash
   git worktree add -b "worker-W-1-granule-G-5" ".worktrees/worker-W-1-granule-G-5"
   ```

2. **Work** (worker makes changes):
   - Worker runs in `.worktrees/worker-W-1-granule-G-5`
   - Makes commits to its isolated branch

3. **Merge** (worker merges to main):
   ```bash
   git fetch origin main
   git checkout main
   git pull origin main
   git merge "worker-W-1-granule-G-5"
   git push origin main
   git branch -d "worker-W-1-granule-G-5"
   ```

4. **Cleanup** (orchestrator removes worktree):
   ```bash
   rm -rf ".worktrees/worker-W-1-granule-G-5"
   git worktree prune
   git branch -D "worker-W-1-granule-G-5"  # if still exists
   ```

**Directory Structure:**
```
granules/
├── .worktrees/
│   ├── worker-W-1-granule-G-1/   # Isolated copy of repo
│   ├── worker-W-2-granule-G-2/   # Isolated copy of repo
│   └── worker-W-3-granule-G-3/   # Isolated copy of repo
└── ...
```

## Exit Condition Logic

The system has a sophisticated exit condition mechanism.

**Trigger Conditions:**
1. A granule with class `"Implemented"` exists
2. No work is in progress:
   - `activeWorkers.size === 0` (no running worker processes)
   - No granules in `"claimed"` state

**Implementation (`orchestrator.ts:114-129`):**
```typescript
const implemented = granules.find((g) => g.class === "Implemented");
const hasWorkInProgress =
  this.activeWorkers.size > 0 ||
  granules.some((g) => g.state === "claimed");

if (implemented && !hasWorkInProgress) {
  this.stop();
  this.onExitCondition?.(implemented.content);
  return;
}

// Don't spawn new work if Implemented exists - let current work finish
if (implemented) {
  console.log(`Waiting for ${this.activeWorkers.size} worker(s) to finish`);
  return;
}
```

**Behavior:**
| State | Action |
|-------|--------|
| No Implemented granule | Continue spawning workers |
| Implemented + work in progress | Wait, don't spawn new workers |
| Implemented + all complete | Stop orchestrator, call exit callback |

**Exit Callback:**
```typescript
// Registered in index.ts
onExitCondition: (report) => {
  console.log("\n--- Final report ---\n");
  console.log(report);  // Content of Implemented granule
  console.log("\n---\n");
  process.exit(0);
}
```

## Key Design Patterns

### Atomic Claims
- `claimGranule()` is idempotent and atomic
- Returns failure if already claimed
- Prevents race conditions between workers

### Summaries for Coordination
- Workers complete granules with summaries
- Summaries capture key decisions and outputs
- Later workers can read prior work via `list_granules()`

### TDD/Incremental Development
- Workers encouraged to create small follow-up granules
- One worker's output becomes next worker's input
- Orchestrator coordinates overall flow

### Stale Claim Recovery
- Claims older than 30 minutes automatically released
- Prevents dead workers from blocking granules
- Allows orchestrator to retry failed work

## Configuration

### MCP Configuration (`mcp-config.json`)

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

### CLI Arguments

| Argument | Description |
|----------|-------------|
| `-p`, `--prompt` | Create initial granule with specified content (class: "implement") instead of default bootstrap granule |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GRANULES_WORKER_CMD` | Claude CLI command | `/Users/stefan/.local/bin/claude` |

### Constants

| Constant | Value | Location |
|----------|-------|----------|
| `MAX_WORKERS` | 3 | orchestrator.ts |
| `LOOP_INTERVAL_MS` | 5000 (5s) | orchestrator.ts |
| `STALE_CLAIM_TIMEOUT_MS` | 1800000 (30min) | orchestrator.ts |
| Server port | 3000 | server.ts |

## Testing

Tests are located alongside their source files (`*.test.ts`) and use Vitest.

- `orchestrator.test.ts` - Orchestrator unit tests
- `server.test.ts` - MCP server integration tests
- `session-log.test.ts` - Session logging unit tests
- `store.test.ts` - GranuleStore unit tests

Run tests with:
```bash
npm test
```

## Directory Structure

```
granules/
├── src/
│   ├── index.ts              # Entry point
│   ├── orchestrator.ts       # Main orchestration loop
│   ├── server.ts             # MCP HTTP server
│   ├── session-log.ts        # Session logging
│   ├── store.ts              # In-memory Store
│   ├── types.ts              # Granule type definitions
│   ├── ui.ts                 # Terminal UI manager
│   ├── worker.ts             # Worker spawning and worktree management
│   ├── tools/                # MCP tool implementations (legacy)
│   │   ├── index.ts
│   │   ├── list_granules.ts
│   │   ├── create_granule.ts
│   │   ├── claim_granule.ts
│   │   ├── release_granule.ts
│   │   └── complete_granule.ts
│   └── *.test.ts             # Tests (vitest)
├── .worktrees/               # Git worktrees for workers (gitignored)
├── logs/                     # Worker logs (gitignored)
│   ├── worker-W-1.log        # Streaming output
│   └── worker-W-1.json       # Final metadata
├── mcp-config.json           # MCP server config for workers
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── ARCHITECTURE.md           # This file
├── CLAUDE.md                 # Claude Code instructions
└── README.md                 # Project documentation
```
