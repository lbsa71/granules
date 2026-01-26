import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createMCPServer } from "./server.js";
import { GranuleStore } from "./store.js";

describe("MCP Server", () => {
  let store: GranuleStore;
  let app: any;

  beforeEach(() => {
    store = new GranuleStore();
    app = createMCPServer(store);
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const res = await supertest(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /tools", () => {
    it("should list all available tools", async () => {
      const res = await supertest(app).get("/tools");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(5);
      expect(res.body.map((t: any) => t.name)).toContain("list_granules");
      expect(res.body.map((t: any) => t.name)).toContain("create_granule");
    });
  });

  describe("POST /tools/list_granules", () => {
    it("should return empty array when no granules", async () => {
      const res = await supertest(app).post("/tools/list_granules").send({});
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should return all granules", async () => {
      store.createGranule("plan", "Test content");
      const res = await supertest(app).post("/tools/list_granules").send({});
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe("Test content");
    });
  });

  describe("POST /tools/create_granule", () => {
    it("should create a new granule", async () => {
      const res = await supertest(app)
        .post("/tools/create_granule")
        .send({ class: "plan", content: "New task" });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("G-1");
      expect(res.body.class).toBe("plan");
      expect(res.body.content).toBe("New task");
    });
  });

  describe("POST /tools/claim_granule", () => {
    it("should successfully claim a granule", async () => {
      const granule = store.createGranule("plan", "Test");
      const res = await supertest(app)
        .post("/tools/claim_granule")
        .send({ granuleId: granule.id, workerId: "W-1" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.granule?.state).toBe("claimed");
    });

    it("should fail to claim already claimed granule", async () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const res = await supertest(app)
        .post("/tools/claim_granule")
        .send({ granuleId: granule.id, workerId: "W-2" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });
});
