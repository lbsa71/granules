import express from "express";
import { getTools } from "./tools/index.js";
import type { GranuleStore } from "./store.js";

export function createMCPServer(store: GranuleStore): express.Application {
  const app = express();
  app.use(express.json());

  const tools = getTools(store);
  const toolsMap = new Map(tools.map((t) => [t.name, t]));

  // MCP tool call endpoint (REST-style)
  app.post("/tools/:toolName", async (req, res) => {
    try {
      const toolName = req.params.toolName;
      const tool = toolsMap.get(toolName);

      if (!tool) {
        return res.status(404).json({ error: `Tool ${toolName} not found` });
      }

      const result = await tool.handler(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // MCP protocol endpoint (for Claude CLI)
  app.post("/mcp", async (req, res) => {
    try {
      const { method, params } = req.body;

      if (method === "tools/list") {
        return res.json({
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });
      }

      if (method === "tools/call") {
        const { name, arguments: args } = params;
        const tool = toolsMap.get(name);

        if (!tool) {
          return res.status(404).json({ error: `Tool ${name} not found` });
        }

        const result = await tool.handler(args);
        return res.json({ content: [{ type: "text", text: JSON.stringify(result) }] });
      }

      res.status(400).json({ error: `Unknown method: ${method}` });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // List available tools
  app.get("/tools", (req, res) => {
    res.json(
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
    );
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

export async function startMCPServer(store: GranuleStore, port: number = 3000): Promise<void> {
  const app = createMCPServer(store);

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`MCP server listening on http://localhost:${port}`);
      resolve();
    });
  });
}
