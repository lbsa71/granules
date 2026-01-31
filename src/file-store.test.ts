import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileStore } from "./file-store.js";
import { computeContentHash } from "./store.js";
import { unlinkSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function tmpFile(): string {
  return join(tmpdir(), `.granules-test-${process.pid}-${Date.now()}.json`);
}

describe("FileStore", () => {
  let path: string;

  beforeEach(() => {
    path = tmpFile();
  });

  afterEach(() => {
    try { unlinkSync(path); } catch { /* ignore */ }
  });

  it("creates granules with contentHash", () => {
    const store = new FileStore(path);
    const g = store.createGranule("implement", "do stuff");
    expect(g.contentHash).toBe(computeContentHash("do stuff"));
    expect(g.id).toBe("G-1");
    expect(g.state).toBe("unclaimed");
  });

  it("persists and reloads state", () => {
    const store1 = new FileStore(path);
    store1.createGranule("plan", "task A");
    store1.createGranule("test", "task B");

    // Reload from same file
    const store2 = new FileStore(path);
    const granules = store2.listGranules();
    expect(granules).toHaveLength(2);
    expect(granules[0].content).toBe("task A");
    expect(granules[1].content).toBe("task B");

    // nextId should continue
    const g3 = store2.createGranule("review", "task C");
    expect(g3.id).toBe("G-3");
  });

  it("persists claim/release/complete mutations", () => {
    const store1 = new FileStore(path);
    const g = store1.createGranule("implement", "work");
    store1.claimGranule(g.id, "W-1");

    const store2 = new FileStore(path);
    const reloaded = store2.getGranule(g.id)!;
    expect(reloaded.state).toBe("claimed");
    expect(reloaded.claimedBy).toBe("W-1");

    store2.completeGranule(g.id, "W-1", "done");

    const store3 = new FileStore(path);
    expect(store3.getGranule(g.id)!.state).toBe("completed");
  });

  it("writes atomically (temp file + rename)", () => {
    const store = new FileStore(path);
    store.createGranule("plan", "atomic test");
    // File should exist and be valid JSON
    expect(existsSync(path)).toBe(true);
    const data = JSON.parse(readFileSync(path, "utf-8"));
    expect(data.granules).toHaveLength(1);
  });

  it("updateGranuleContent updates content and hash", () => {
    const store = new FileStore(path);
    const g = store.createGranule("implement", "original");
    const oldHash = g.contentHash;

    const result = store.updateGranuleContent(g.id, "updated");
    expect(result.success).toBe(true);
    expect(result.granule!.content).toBe("updated");
    expect(result.granule!.contentHash).toBe(computeContentHash("updated"));
    expect(result.granule!.contentHash).not.toBe(oldHash);

    // Verify persistence
    const store2 = new FileStore(path);
    expect(store2.getGranule(g.id)!.content).toBe("updated");
  });

  it("returns failure for non-existent granule", () => {
    const store = new FileStore(path);
    expect(store.updateGranuleContent("G-999", "x").success).toBe(false);
    expect(store.claimGranule("G-999", "W-1").success).toBe(false);
  });

  it("handles stale claims", () => {
    const store = new FileStore(path);
    const g = store.createGranule("implement", "stale");
    store.claimGranule(g.id, "W-1");

    // Manually backdate claimedAt
    const granule = store.getGranule(g.id)!;
    (granule as any).claimedAt = Date.now() - 100_000;

    const stale = store.getStaleClaims(50_000);
    expect(stale).toHaveLength(1);

    const released = store.releaseStaleClaims(50_000);
    expect(released).toBe(1);
    expect(store.getGranule(g.id)!.state).toBe("unclaimed");
  });

  it("starts fresh when file does not exist", () => {
    const store = new FileStore(join(tmpdir(), "nonexistent-" + Date.now() + ".json"));
    expect(store.listGranules()).toHaveLength(0);
  });
});

describe("computeContentHash", () => {
  it("produces consistent SHA-256 hex", () => {
    const hash = computeContentHash("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(computeContentHash("hello")).toBe(hash);
    expect(computeContentHash("world")).not.toBe(hash);
  });
});
