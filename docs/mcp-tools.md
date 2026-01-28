# MCP Tools Reference

The MCP server exposes five tools for granule management.

## Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `list_granules` | - | `Granule[]` | Get all granules |
| `create_granule` | `{class, content}` | `Granule` | Create new granule |
| `claim_granule` | `{granuleId, workerId}` | `{success, granule?}` | Atomic claim; fails if already claimed |
| `release_granule` | `{granuleId, workerId}` | `{success}` | Release claim |
| `complete_granule` | `{granuleId, workerId, summary?}` | `{success}` | Mark done |

## Server Configuration

Workers connect via `mcp-config.json`:

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

## Transport

- **Protocol**: StreamableHTTP (stateless mode)
- **URL**: `http://localhost:3000`
- **Endpoints**: `POST /` or `POST /mcp` for MCP protocol, `GET /health` for health check
