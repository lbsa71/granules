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

});

