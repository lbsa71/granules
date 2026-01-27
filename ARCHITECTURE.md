# GRANULES Architecture

This document describes the system architecture, component interactions, data flow, and design decisions for the GRANULES multi-agent orchestrator.

## Overview

GRANULES is a minimal multi-agent orchestrator where an MCP (Model Context Protocol) server holds work items called "granules" and Claude Code CLI instances act as workers that claim and complete them.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Orchestrator                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Store    │  │ MCP Server  │  │   Worker    │             │
│  │ (in-memory) │◄─│   (HTTP)    │  │  Spawner    │             │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘             │
│                          │                │                     │
└──────────────────────────┼────────────────┼─────────────────────┘
                           │                │
              MCP Protocol │                │ spawns
                           │                ▼
                    ┌──────┴────────────────────────┐
                    │         Workers (Claude CLI)  │
                    │  ┌─────┐  ┌─────┐  ┌─────┐   │
                    │  │ W-1 │  │ W-2 │  │ W-3 │   │
                    │  └─────┘  └─────┘  └─────┘   │
                    └──────────────────────────────┘
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

**Key Design Decisions:**
- **In-memory only**: No persistence. This simplifies the implementation and fits the ephemeral nature of orchestration runs.
- **Atomic claims**: The `claimGranule` method checks and updates state atomically to prevent race conditions between workers.

### 2. MCP Server (`src/server.ts`)

HTTP server exposing the granule operations via the Model Context Protocol.

**Endpoints:**
- `POST /` or `POST /mcp` - MCP protocol endpoint
- `GET /health` - Health check

**MCP Tools:**
| Tool | Description |
|------|-------------|
| `list_granules` | Get all granules |
| `create_granule` | Create a new granule with class and content |
| `claim_granule` | Atomically claim a granule for a worker |
| `release_granule` | Release a claimed granule back to unclaimed |
| `complete_granule` | Mark a granule as completed with optional summary |

**Key Design Decisions:**
- **Stateless HTTP transport**: Each request is independent; no session management required.
- **In-memory transport for testing**: Allows unit tests without spinning up HTTP servers.

### 3. Orchestrator (`src/orchestrator.ts`)

The main control loop that manages workers and monitors granules.

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

**Worker Isolation:**
Each worker runs in an isolated git worktree:
- Branch: `worker-{workerId}-granule-{granuleId}`
- Location: `.worktrees/{branchName}/`

This allows multiple workers to make concurrent changes without conflicts.

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
| `Implemented` | Exit condition - signals project completion |

## Data Flow

### 1. Startup Flow

```
main() ──► GranuleStore ──► Orchestrator.start()
                                  │
                                  ├── cleanupLogs()
                                  ├── startMcpHttpServer()
                                  ├── createBootstrapGranule() (if empty)
                                  └── tick() loop
```

### 2. Worker Lifecycle Flow

```
tick() ──► finds unclaimed granule
      │
      └──► spawnWorkerForGranule()
                  │
                  ├── Create git worktree
                  ├── Generate prompt
                  ├── Spawn Claude CLI
                  │        │
                  │        └──► Worker claims granule (via MCP)
                  │             Worker does work
                  │             Worker may create new granules
                  │             Worker completes granule (via MCP)
                  │
                  └── On exit: cleanup worktree & branch
```

### 3. MCP Tool Call Flow

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

## Design Principles

### 1. Self-Building
GRANULES bootstraps itself - the first worker plans, subsequent workers implement. The system can evolve itself through the granule workflow.

### 2. Atomic Claims
Only one worker can claim a granule; the claim fails if already taken. This ensures no duplicate work.

### 3. Summaries Enable Coordination
Completed granules include summaries so workers can understand prior work. This creates implicit coordination without direct worker communication.

### 4. Isolated Workspaces
Each worker operates in its own git worktree, preventing merge conflicts during concurrent development.

### 5. Minimal Dependencies
The system uses only essential dependencies:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server (used by MCP transport)

## Testing

Tests are located alongside their source files (`*.test.ts`) and use Vitest.

- `store.test.ts` - GranuleStore unit tests
- `server.test.ts` - MCP server integration tests
- `orchestrator.test.ts` - Orchestrator unit tests

Run tests with:
```bash
npm test
```

## Directory Structure

```
granules/
├── src/
│   ├── index.ts         # Entry point
│   ├── server.ts        # MCP server
│   ├── store.ts         # Granule data store
│   ├── orchestrator.ts  # Main control loop
│   ├── worker.ts        # Worker spawning
│   ├── types.ts         # Type definitions
│   ├── tools/           # MCP tool implementations
│   │   ├── index.ts
│   │   ├── list_granules.ts
│   │   ├── create_granule.ts
│   │   ├── claim_granule.ts
│   │   ├── release_granule.ts
│   │   └── complete_granule.ts
│   └── *.test.ts        # Test files
├── logs/                # Worker output logs (gitignored)
├── .worktrees/          # Git worktrees for workers (gitignored)
├── ARCHITECTURE.md      # This file
├── CLAUDE.md            # Instructions for AI assistants
├── README.md            # Project documentation
└── package.json
```
