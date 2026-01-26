import { describe, it, expect, beforeEach } from "vitest";
import { GranuleStore } from "./store.js";
import type { Granule, GranuleClass } from "./types.js";

describe("GranuleStore", () => {
  let store: GranuleStore;

  beforeEach(() => {
    store = new GranuleStore();
  });

  describe("createGranule", () => {
    it("should create a granule with auto-incremented ID", () => {
      const granule = store.createGranule("plan", "Test content");
      expect(granule.id).toBe("G-1");
      expect(granule.class).toBe("plan");
      expect(granule.content).toBe("Test content");
      expect(granule.state).toBe("unclaimed");
      expect(granule.createdAt).toBeGreaterThan(0);
    });

    it("should auto-increment IDs sequentially", () => {
      const g1 = store.createGranule("plan", "Content 1");
      const g2 = store.createGranule("implement", "Content 2");
      const g3 = store.createGranule("test", "Content 3");

      expect(g1.id).toBe("G-1");
      expect(g2.id).toBe("G-2");
      expect(g3.id).toBe("G-3");
    });
  });

  describe("listGranules", () => {
    it("should return empty array when no granules exist", () => {
      expect(store.listGranules()).toEqual([]);
    });

    it("should return all granules", () => {
      store.createGranule("plan", "Content 1");
      store.createGranule("implement", "Content 2");
      const granules = store.listGranules();
      expect(granules).toHaveLength(2);
    });
  });

  describe("claimGranule", () => {
    it("should successfully claim an unclaimed granule", () => {
      const granule = store.createGranule("plan", "Test");
      const result = store.claimGranule(granule.id, "W-1");

      expect(result.success).toBe(true);
      expect(result.granule).toBeDefined();
      expect(result.granule?.state).toBe("claimed");
      expect(result.granule?.claimedBy).toBe("W-1");
      expect(result.granule?.claimedAt).toBeGreaterThan(0);
    });

    it("should fail to claim an already claimed granule", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const result = store.claimGranule(granule.id, "W-2");

      expect(result.success).toBe(false);
      expect(result.granule).toBeUndefined();
    });

    it("should fail to claim a non-existent granule", () => {
      const result = store.claimGranule("G-999", "W-1");
      expect(result.success).toBe(false);
    });

    it("should fail to claim a completed granule", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      store.completeGranule(granule.id, "W-1", "Done");
      const result = store.claimGranule(granule.id, "W-2");

      expect(result.success).toBe(false);
    });
  });

  describe("releaseGranule", () => {
    it("should successfully release a claimed granule", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const result = store.releaseGranule(granule.id, "W-1");

      expect(result.success).toBe(true);
      const updated = store.getGranule(granule.id);
      expect(updated?.state).toBe("unclaimed");
      expect(updated?.claimedBy).toBeUndefined();
      expect(updated?.claimedAt).toBeUndefined();
    });

    it("should fail to release a granule claimed by different worker", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const result = store.releaseGranule(granule.id, "W-2");

      expect(result.success).toBe(false);
    });

    it("should fail to release a non-existent granule", () => {
      const result = store.releaseGranule("G-999", "W-1");
      expect(result.success).toBe(false);
    });
  });

  describe("completeGranule", () => {
    it("should successfully complete a claimed granule", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const result = store.completeGranule(granule.id, "W-1", "Summary");

      expect(result.success).toBe(true);
      const updated = store.getGranule(granule.id);
      expect(updated?.state).toBe("completed");
      expect(updated?.summary).toBe("Summary");
      expect(updated?.completedAt).toBeGreaterThan(0);
    });

    it("should fail to complete a granule not claimed by the worker", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      const result = store.completeGranule(granule.id, "W-2", "Summary");

      expect(result.success).toBe(false);
    });

    it("should fail to complete a non-existent granule", () => {
      const result = store.completeGranule("G-999", "W-1", "Summary");
      expect(result.success).toBe(false);
    });
  });

  describe("getStaleClaims", () => {
    it("should return granules with claims older than 30 minutes", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");
      
      // Manually set claimedAt to 31 minutes ago
      const granuleData = store.getGranule(granule.id);
      if (granuleData) {
        granuleData.claimedAt = Date.now() - 31 * 60 * 1000;
      }

      const stale = store.getStaleClaims(30 * 60 * 1000);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe(granule.id);
    });

    it("should not return granules with recent claims", () => {
      const granule = store.createGranule("plan", "Test");
      store.claimGranule(granule.id, "W-1");

      const stale = store.getStaleClaims(30 * 60 * 1000);
      expect(stale).toHaveLength(0);
    });
  });

  describe("releaseStaleClaims", () => {
    it("should release all stale claims", () => {
      const g1 = store.createGranule("plan", "Test 1");
      const g2 = store.createGranule("implement", "Test 2");
      
      store.claimGranule(g1.id, "W-1");
      store.claimGranule(g2.id, "W-2");

      // Make g1 stale (31 minutes ago)
      const granule1 = store.getGranule(g1.id);
      if (granule1) {
        granule1.claimedAt = Date.now() - 31 * 60 * 1000;
      }

      const released = store.releaseStaleClaims(30 * 60 * 1000);
      expect(released).toBe(1);

      const updated1 = store.getGranule(g1.id);
      expect(updated1?.state).toBe("unclaimed");

      const updated2 = store.getGranule(g2.id);
      expect(updated2?.state).toBe("claimed");
    });
  });
});
