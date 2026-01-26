import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createInMemoryMcpServer, createMcpServer } from "./server.js";
import { GranuleStore } from "./store.js";

describe("MCP Server Integration", () => {
  let store: GranuleStore;
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    store = new GranuleStore();
    const { server, clientTransport, serverTransport } = createInMemoryMcpServer(store);

    // Connect server to its transport
    await server.connect(serverTransport);

    // Create and connect client
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("tools/list", () => {
    it("should list all available tools", async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(5);
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("list_granules");
      expect(toolNames).toContain("create_granule");
      expect(toolNames).toContain("claim_granule");
      expect(toolNames).toContain("release_granule");
      expect(toolNames).toContain("complete_granule");
    });

    it("should have correct input schemas", async () => {
      const result = await client.listTools();

      const createTool = result.tools.find((t) => t.name === "create_granule");
      expect(createTool).toBeDefined();
      expect(createTool!.inputSchema.required).toContain("class");
      expect(createTool!.inputSchema.required).toContain("content");
    });
  });

  describe("list_granules tool", () => {
    it("should return empty array when no granules", async () => {
      const result = await client.callTool({ name: "list_granules", arguments: {} });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        expect(JSON.parse(content.text)).toEqual([]);
      }
    });

    it("should return all granules", async () => {
      store.createGranule("plan", "Test content");

      const result = await client.callTool({ name: "list_granules", arguments: {} });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const granules = JSON.parse(content.text);
        expect(granules).toHaveLength(1);
        expect(granules[0].content).toBe("Test content");
      }
    });
  });

  describe("create_granule tool", () => {
    it("should create a new granule", async () => {
      const result = await client.callTool({
        name: "create_granule",
        arguments: { class: "plan", content: "New task" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const granule = JSON.parse(content.text);
        expect(granule.id).toBe("G-1");
        expect(granule.class).toBe("plan");
        expect(granule.content).toBe("New task");
      }
    });

    it("should validate granule class", async () => {
      const result = await client.callTool({
        name: "create_granule",
        arguments: { class: "invalid", content: "Test" },
      });

      // MCP returns validation errors with isError: true, not by throwing
      expect(result.isError).toBe(true);
    });
  });

  describe("claim_granule tool", () => {
    it("should successfully claim a granule", async () => {
      const granule = store.createGranule("plan", "Test");

      const result = await client.callTool({
        name: "claim_granule",
        arguments: { granuleId: granule.id, workerId: "W-1" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const claimResult = JSON.parse(content.text);
        expect(claimResult.success).toBe(true);
        expect(claimResult.granule?.state).toBe("claimed");
      }
    });

    it("should fail to claim already claimed granule", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const result = await client.callTool({
        name: "claim_granule",
        arguments: { granuleId: granule.id, workerId: "W-2" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const claimResult = JSON.parse(content.text);
        expect(claimResult.success).toBe(false);
      }
    });
  });

  describe("release_granule tool", () => {
    it("should release a claimed granule", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const result = await client.callTool({
        name: "release_granule",
        arguments: { granuleId: granule.id, workerId: "W-1" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const releaseResult = JSON.parse(content.text);
        expect(releaseResult.success).toBe(true);
      }

      // Verify the granule was actually released
      const updatedGranule = store.getGranule(granule.id);
      expect(updatedGranule?.state).toBe("unclaimed");
    });

    it("should fail to release granule claimed by another worker", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const result = await client.callTool({
        name: "release_granule",
        arguments: { granuleId: granule.id, workerId: "W-2" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const releaseResult = JSON.parse(content.text);
        expect(releaseResult.success).toBe(false);
      }
    });
  });

  describe("complete_granule tool", () => {
    it("should complete a claimed granule", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const result = await client.callTool({
        name: "complete_granule",
        arguments: { granuleId: granule.id, workerId: "W-1", summary: "Done" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const completeResult = JSON.parse(content.text);
        expect(completeResult.success).toBe(true);
      }

      // Verify the granule was actually completed
      const updatedGranule = store.getGranule(granule.id);
      expect(updatedGranule?.state).toBe("completed");
      expect(updatedGranule?.summary).toBe("Done");
    });

    it("should fail to complete granule claimed by another worker", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const result = await client.callTool({
        name: "complete_granule",
        arguments: { granuleId: granule.id, workerId: "W-2" },
      });

      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type === "text") {
        const completeResult = JSON.parse(content.text);
        expect(completeResult.success).toBe(false);
      }
    });
  });
});
