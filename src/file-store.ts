import { readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { computeContentHash } from "./store.js";
import type { Granule, GranuleClass, Store } from "./types.js";

interface FileStoreState {
  nextId: number;
  granules: Granule[];
}

export class FileStore implements Store {
  private granules: Map<string, Granule> = new Map();
  private nextId: number = 1;
  private filePath: string;

  constructor(filePath: string = ".granules-state.json") {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      const data = readFileSync(this.filePath, "utf-8");
      const state: FileStoreState = JSON.parse(data);
      this.nextId = state.nextId;
      this.granules = new Map(state.granules.map((g) => [g.id, g]));
    } catch {
      // File doesn't exist or is invalid — start fresh
    }
  }

  private persist(): void {
    const state: FileStoreState = {
      nextId: this.nextId,
      granules: Array.from(this.granules.values()),
    };
    const json = JSON.stringify(state, null, 2);
    // Atomic write: write to temp file then rename
    const dir = dirname(this.filePath) || ".";
    mkdirSync(dir, { recursive: true });
    const tmpPath = join(dir, `.granules-tmp-${process.pid}-${Date.now()}.json`);
    writeFileSync(tmpPath, json, "utf-8");
    renameSync(tmpPath, this.filePath);
  }

  createGranule(class_: GranuleClass, content: string): Granule {
    const id = `G-${this.nextId++}`;
    const granule: Granule = {
      id,
      class: class_,
      content,
      contentHash: computeContentHash(content),
      state: "unclaimed",
      createdAt: Date.now(),
    };
    this.granules.set(id, granule);
    this.persist();
    return granule;
  }

  listGranules(): Granule[] {
    return Array.from(this.granules.values());
  }

  getGranule(id: string): Granule | undefined {
    return this.granules.get(id);
  }

  claimGranule(granuleId: string, workerId: string): { success: boolean; granule?: Granule } {
    const granule = this.granules.get(granuleId);
    if (!granule || granule.state !== "unclaimed") {
      return { success: false };
    }
    granule.state = "claimed";
    granule.claimedBy = workerId;
    granule.claimedAt = Date.now();
    this.persist();
    return { success: true, granule: { ...granule } };
  }

  releaseGranule(granuleId: string, workerId: string, error?: string): { success: boolean } {
    const granule = this.granules.get(granuleId);
    if (!granule || granule.state !== "claimed" || granule.claimedBy !== workerId) {
      return { success: false };
    }
    granule.state = "unclaimed";
    granule.claimedBy = undefined;
    granule.claimedAt = undefined;
    if (error) {
      granule.retryCount = (granule.retryCount ?? 0) + 1;
      granule.lastError = error;
    }
    this.persist();
    return { success: true };
  }

  completeGranule(granuleId: string, workerId: string, summary?: string): { success: boolean } {
    const granule = this.granules.get(granuleId);
    if (!granule || granule.state !== "claimed" || granule.claimedBy !== workerId) {
      return { success: false };
    }
    granule.state = "completed";
    granule.completedAt = Date.now();
    if (summary !== undefined) {
      granule.summary = summary;
    }
    this.persist();
    return { success: true };
  }

  getStaleClaims(maxAgeMs: number): Granule[] {
    const now = Date.now();
    return Array.from(this.granules.values()).filter(
      (g) => g.state === "claimed" && g.claimedAt !== undefined && now - g.claimedAt > maxAgeMs
    );
  }

  releaseStaleClaims(maxAgeMs: number): number {
    const stale = this.getStaleClaims(maxAgeMs);
    for (const granule of stale) {
      granule.state = "unclaimed";
      granule.claimedBy = undefined;
      granule.claimedAt = undefined;
    }
    if (stale.length > 0) {
      this.persist();
    }
    return stale.length;
  }

  updateGranuleContent(granuleId: string, content: string): { success: boolean; granule?: Granule } {
    const granule = this.granules.get(granuleId);
    if (!granule) {
      return { success: false };
    }
    granule.content = content;
    granule.contentHash = computeContentHash(content);
    this.persist();
    return { success: true, granule: { ...granule } };
  }
}
