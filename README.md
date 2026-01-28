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

## Granule Classes

| Class | Purpose |
|-------|---------|
| `explore` | Understand codebase/context |
| `plan` | Design implementation approach |
| `implement` | Write/modify code (artifacts) |
| `test` | Write or run tests |
| `review` | Critique another worker's output |
| `consolidate` | Merge work from multiple workers |
| `Implemented` | Exit condition: orchestrator stops |

## Quick Start

```bash
# Run with npx (no installation)
npx @lbsa71/granules

# Or with a specific task
npx @lbsa71/granules -p "Add dark mode support"
```

## Project Structure

```
granules/
├── src/
│   ├── index.ts         # Entry point
│   ├── orchestrator.ts  # Main loop, worker spawning
│   ├── server.ts        # MCP server setup
│   ├── store.ts         # In-memory granule store
│   ├── types.ts         # Type definitions
│   ├── worker.ts        # Worker spawning, CLASS_PROMPTS
│   ├── ui.ts            # Terminal UI
│   ├── session-log.ts   # Session logging
│   ├── tools/           # MCP tool implementations
│   └── *.test.ts        # Tests
├── docs/                # Detailed documentation
├── logs/                # Worker output logs
└── mcp-config.json      # MCP server config
```

## Documentation

- [MCP Tools Reference](docs/mcp-tools.md)
- [Worker Prompt System](docs/worker-prompts.md)
- [Configuration](docs/configuration.md)
- [Architecture](ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)

## CI/CD

The package `@lbsa71/granules` is automatically published to npm on every push to `main`. Add `NPM_TOKEN` secret to GitHub repository settings.
