import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the orchestrator module before any imports
const mockStop = vi.fn();
const mockStart = vi.fn().mockResolvedValue(undefined);

vi.mock("./orchestrator.js", () => ({
  Orchestrator: vi.fn(() => ({
    start: mockStart,
    stop: mockStop,
  })),
}));

vi.mock("./store.js", () => ({
  GranuleStore: vi.fn(() => ({})),
}));

describe("graceful shutdown", () => {
  let processListeners: Map<string, ((...args: unknown[]) => void)[]>;
  const originalOn = process.on.bind(process);
  const originalExit = process.exit;

  beforeEach(() => {
    processListeners = new Map();
    vi.resetModules();
    mockStop.mockClear();
    mockStart.mockClear();

    // Mock process.on to capture signal handlers
    vi.spyOn(process, "on").mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
      const listeners = processListeners.get(event) || [];
      listeners.push(listener);
      processListeners.set(event, listeners);
      return process;
    });

    // Mock process.exit to prevent actually exiting
    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register SIGTERM handler", async () => {
    await import("./index.js");
    expect(processListeners.has("SIGTERM")).toBe(true);
  });

  it("should register SIGINT handler", async () => {
    await import("./index.js");
    expect(processListeners.has("SIGINT")).toBe(true);
  });

  it("should call orchestrator.stop() on SIGTERM", async () => {
    await import("./index.js");

    const sigTermHandlers = processListeners.get("SIGTERM") || [];
    expect(sigTermHandlers.length).toBeGreaterThan(0);

    // Trigger SIGTERM handler
    sigTermHandlers[0]?.();

    expect(mockStop).toHaveBeenCalled();
  });

  it("should call orchestrator.stop() on SIGINT", async () => {
    await import("./index.js");

    const sigIntHandlers = processListeners.get("SIGINT") || [];
    expect(sigIntHandlers.length).toBeGreaterThan(0);

    // Trigger SIGINT handler
    sigIntHandlers[0]?.();

    expect(mockStop).toHaveBeenCalled();
  });

  it("should exit with code 0 after graceful shutdown", async () => {
    await import("./index.js");

    const sigTermHandlers = processListeners.get("SIGTERM") || [];
    sigTermHandlers[0]?.();

    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
