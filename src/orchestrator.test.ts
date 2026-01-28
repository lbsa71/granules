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
  startMcpHttpServer: vi.fn().mockResolvedValue(undefined),
}));

// Mock UI to avoid stdin issues in tests
vi.mock("./ui.js", () => ({
  UIManager: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn(),
    onCommand: null,
    onExit: null,
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
    expect(granules[0].content).toContain("gap analysis");
  });

  it("should not create bootstrap granule if granules exist", async () => {
    store.createGranule("implement", "Test task");
    await orchestrator.start();
    const granules = store.listGranules();
    expect(granules).toHaveLength(1);
    expect(granules[0].class).toBe("implement");
  });

  it("should use custom prompt for initial granule when provided", async () => {
    await orchestrator.start("Implement a custom feature");
    const granules = store.listGranules();
    expect(granules).toHaveLength(1);
    expect(granules[0].class).toBe("implement");
    expect(granules[0].content).toBe("Implement a custom feature");
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

  it("should defer audit granules while other work exists", async () => {
    const { spawnWorker } = await import("./worker.js");
    vi.mocked(spawnWorker).mockClear();

    store.createGranule("implement", "Do something.");
    store.createGranule("audit", "Done.");
    orchestrator = new Orchestrator(store);

    await orchestrator.start();

    // Should only spawn for the implement granule, not the audit one
    expect(spawnWorker).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spawnWorker).mock.calls[0]![1]!.class).toBe("implement");
  });

  it("should spawn workers for unclaimed granules", async () => {
    const { spawnWorker } = await import("./worker.js");
    vi.mocked(spawnWorker).mockClear();

    store.createGranule("implement", "Do something");
    orchestrator = new Orchestrator(store);

    await orchestrator.start();

    expect(spawnWorker).toHaveBeenCalledOnce();
  });

  it("should kill all active workers on stop", async () => {
    const mockKill = vi.fn();
    const { spawnWorker } = await import("./worker.js");
    vi.mocked(spawnWorker).mockImplementation(() => ({
      on: vi.fn(),
      kill: mockKill,
      killed: false,
      exitCode: null,
    }) as unknown as ReturnType<typeof spawnWorker>);

    store.createGranule("implement", "Test task");
    orchestrator = new Orchestrator(store);

    await orchestrator.start();
    orchestrator.stop();

    expect(mockKill).toHaveBeenCalled();
  });

  describe("error handling", () => {
    it("should not spawn worker for granule that exceeds MAX_RETRIES", async () => {
      const { spawnWorker } = await import("./worker.js");
      vi.mocked(spawnWorker).mockClear();

      const granule = store.createGranule("implement", "Test task");
      // Manually set retry count to exceed MAX_RETRIES (3)
      const g = store.getGranule(granule.id);
      if (g) {
        g.retryCount = 3;
      }

      orchestrator = new Orchestrator(store);
      await orchestrator.start();

      // Should not spawn worker for granule with too many retries
      expect(spawnWorker).not.toHaveBeenCalled();
    });

    it("should handle missing granule gracefully in spawnWorkerForGranule", async () => {
      const { spawnWorker } = await import("./worker.js");

      // Pre-create a granule so bootstrap doesn't create one
      store.createGranule("implement", "Existing task");
      orchestrator = new Orchestrator(store);
      await orchestrator.start();

      // Clear spawnWorker calls from start
      vi.mocked(spawnWorker).mockClear();

      // Try to spawn for non-existent granule directly
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      orchestrator["spawnWorkerForGranule"]("G-999");

      expect(consoleSpy).toHaveBeenCalledWith("Granule G-999 not found");
      expect(spawnWorker).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should clean up completed workers from active workers map", async () => {
      const { spawnWorker } = await import("./worker.js");

      const mockProcess = {
        on: vi.fn(),
        kill: vi.fn(),
        killed: false,
        exitCode: null as number | null,
      };

      vi.mocked(spawnWorker).mockClear();
      vi.mocked(spawnWorker).mockReturnValue(mockProcess);

      store.createGranule("implement", "Test task");
      orchestrator = new Orchestrator(store);
      await orchestrator.start();

      // Initially have one active worker
      expect(orchestrator["activeWorkers"].size).toBe(1);

      // Simulate process completion
      mockProcess.exitCode = 0;
      orchestrator["cleanupCompletedWorkers"]();

      // Worker should be removed from active workers
      expect(orchestrator["activeWorkers"].size).toBe(0);
    });

    it("should clean up killed workers from active workers map", async () => {
      const { spawnWorker } = await import("./worker.js");

      const mockProcess = {
        on: vi.fn(),
        kill: vi.fn(),
        killed: false,
        exitCode: null as number | null,
      };

      vi.mocked(spawnWorker).mockClear();
      vi.mocked(spawnWorker).mockReturnValue(mockProcess);

      store.createGranule("implement", "Test task");
      orchestrator = new Orchestrator(store);
      await orchestrator.start();

      // Simulate process being killed
      mockProcess.killed = true;
      orchestrator["cleanupCompletedWorkers"]();

      // Worker should be removed from active workers
      expect(orchestrator["activeWorkers"].size).toBe(0);
    });

    it("should track granule retry count from release errors", () => {
      // This tests the store's error tracking which is used by orchestrator
      const granule = store.createGranule("implement", "Test task");
      store.claimGranule(granule.id, "W-1");
      store.releaseGranule(granule.id, "W-1", "Worker exited with code 1");

      const updated = store.getGranule(granule.id);
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toBe("Worker exited with code 1");
    });

    it("should accumulate retry count across multiple failures", () => {
      const granule = store.createGranule("implement", "Test task");

      // Simulate multiple worker failures
      for (let i = 0; i < 3; i++) {
        store.claimGranule(granule.id, `W-${i + 1}`);
        store.releaseGranule(granule.id, `W-${i + 1}`, `Error ${i + 1}`);
      }

      const updated = store.getGranule(granule.id);
      expect(updated?.retryCount).toBe(3);
      expect(updated?.lastError).toBe("Error 3");
    });
  });
});

