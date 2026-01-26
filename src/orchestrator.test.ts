import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { GranuleStore } from "./store.js";

// Mock worker spawning
vi.mock("./worker.js", () => ({
  spawnWorker: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    killed: false,
    exitCode: null,
  })),
}));

describe("Orchestrator", () => {
  let store: GranuleStore;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    store = new GranuleStore();
    orchestrator = new Orchestrator(store);
    vi.useFakeTimers();
  });

  afterEach(() => {
    orchestrator.stop();
    vi.useRealTimers();
  });

  it("should create bootstrap granule if none exist", async () => {
    await orchestrator.start();
    const granules = store.listGranules();
    expect(granules).toHaveLength(1);
    expect(granules[0].class).toBe("plan");
    expect(granules[0].content).toContain("plan the implementation");
  });

  it("should not create bootstrap granule if granules exist", async () => {
    store.createGranule("implement", "Test task");
    await orchestrator.start();
    const granules = store.listGranules();
    expect(granules).toHaveLength(1);
    expect(granules[0].class).toBe("implement");
  });

  it("should release stale claims in tick", async () => {
    await orchestrator.start();
    const granule = store.createGranule("plan", "Test");
    store.claimGranule(granule.id, "W-1");

    // Make claim stale (31 minutes ago)
    const g = store.getGranule(granule.id);
    if (g) {
      g.claimedAt = Date.now() - 31 * 60 * 1000;
    }

    orchestrator["tick"]();
    const updated = store.getGranule(granule.id);
    expect(updated?.state).toBe("unclaimed");
  });
});
