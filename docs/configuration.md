# Configuration

## CLI Arguments

| Argument | Description |
|----------|-------------|
| `-p`, `--prompt` | Create initial granule with specified content (class: "implement") instead of default bootstrap |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GRANULES_WORKER_CMD` | Claude CLI command | `/Users/stefan/.local/bin/claude` |

## Constants

| Constant | Value | Location |
|----------|-------|----------|
| `MAX_WORKERS` | 3 | orchestrator.ts |
| `LOOP_INTERVAL_MS` | 5000 (5s) | orchestrator.ts |
| `STALE_CLAIM_TIMEOUT_MS` | 1800000 (30min) | orchestrator.ts |
| Server port | 3000 | server.ts |

## Examples

Start with a specific task:
```bash
npx @lbsa71/granules -p "Add dark mode support to the UI"
```

Start with default bootstrap behavior (gap analysis):
```bash
npx @lbsa71/granules
```

Override Claude CLI path:
```bash
GRANULES_WORKER_CMD=/opt/homebrew/bin/claude npx @lbsa71/granules
```

Use npx for Claude:
```bash
GRANULES_WORKER_CMD="npx --yes @anthropic-ai/claude-code" npx @lbsa71/granules
```
