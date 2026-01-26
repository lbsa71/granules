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

// Avoid binding to port in tests
vi.mock("./server.js", () => ({
  startMCPServer: vi.fn().mockResolvedValue(undefined),
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
    expect(granules[0].content).toContain("gap analysis");
    expect(granules[0].content).toContain("Implemented");
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

  it("should run onExitCondition with content and stop when an Implemented granule exists", async () => {
    const onExitCondition = vi.fn();
    store.createGranule("Implemented", "Final assessment: project complete.");
    const orch = new Orchestrator(store, { onExitCondition });

    await orch.start();

    expect(onExitCondition).toHaveBeenCalledOnce();
    expect(onExitCondition).toHaveBeenCalledWith("Final assessment: project complete.");
  });

  it("should not spawn workers for Implemented granules", async () => {
    const { spawnWorker } = await import("./worker.js");
    vi.mocked(spawnWorker).mockClear();

    store.createGranule("Implemented", "Done.");
    orchestrator = new Orchestrator(store);

    await orchestrator.start();

    expect(spawnWorker).not.toHaveBeenCalled();
  });
});
