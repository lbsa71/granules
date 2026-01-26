import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import http from "http";
import type { GranuleStore } from "./store.js";
import type { GranuleClass } from "./types.js";

export function createMcpServer(store: GranuleStore): McpServer {
  const server = new McpServer({
    name: "granules",
    version: "1.0.0",
  });

  // Register list_granules tool
  server.tool(
    "list_granules",
    "Get all granules",
    {},
    async () => {
      const granules = store.listGranules();
      return {
        content: [{ type: "text", text: JSON.stringify(granules) }],
      };
    }
  );

  // Register create_granule tool
  server.tool(
    "create_granule",
    "Create new granule",
    {
      class: z.enum(["explore", "plan", "implement", "test", "review", "consolidate", "Implemented"]),
      content: z.string(),
    },
    async ({ class: granuleClass, content }) => {
      const granule = store.createGranule(granuleClass as GranuleClass, content);
      return {
        content: [{ type: "text", text: JSON.stringify(granule) }],
      };
    }
  );

  // Register claim_granule tool
  server.tool(
    "claim_granule",
    "Atomically claim a granule. Fails if already claimed.",
    {
      granuleId: z.string(),
      workerId: z.string(),
    },
    async ({ granuleId, workerId }) => {
      const result = store.claimGranule(granuleId, workerId);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );

  // Register release_granule tool
  server.tool(
    "release_granule",
    "Release a claimed granule",
    {
      granuleId: z.string(),
      workerId: z.string(),
    },
    async ({ granuleId, workerId }) => {
      const result = store.releaseGranule(granuleId, workerId);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );

  // Register complete_granule tool
  server.tool(
    "complete_granule",
    "Mark a granule as completed",
    {
      granuleId: z.string(),
      workerId: z.string(),
      summary: z.string().optional(),
    },
    async ({ granuleId, workerId, summary }) => {
      const result = store.completeGranule(granuleId, workerId, summary);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );

  return server;
}

/**
 * Create an MCP server connected via in-memory transport (for testing)
 */
export function createInMemoryMcpServer(store: GranuleStore): {
  server: McpServer;
  clientTransport: InMemoryTransport;
  serverTransport: InMemoryTransport;
} {
  const server = createMcpServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  return { server, clientTransport, serverTransport };
}

/**
 * Start an HTTP MCP server using StreamableHTTP transport
 */
export async function startMcpHttpServer(
  store: GranuleStore,
  port: number = 3000
): Promise<{ server: McpServer; httpServer: http.Server }> {
  const mcpServer = createMcpServer(store);

  // Create transport for stateless mode (each request is independent)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Connect MCP server to transport
  await mcpServer.connect(transport);

  // Create HTTP server to handle requests
  const httpServer = http.createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // MCP endpoint
    if (req.url === "/mcp" || req.url === "/") {
      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error) }));
        }
      }
      return;
    }

    // 404 for other routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.log(`MCP server listening on http://localhost:${port}`);
      resolve({ server: mcpServer, httpServer });
    });
  });
}
