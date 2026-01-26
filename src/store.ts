import type { Granule, GranuleClass } from "./types.js";

export class GranuleStore {
  private granules: Map<string, Granule> = new Map();
  private nextId: number = 1;

  createGranule(class_: GranuleClass, content: string): Granule {
    const id = `G-${this.nextId++}`;
    const now = Date.now();
    const granule: Granule = {
      id,
      class: class_,
      content,
      state: "unclaimed",
      createdAt: now,
    };
    this.granules.set(id, granule);
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
    if (!granule) {
      return { success: false };
    }

    if (granule.state !== "unclaimed") {
      return { success: false };
    }

    granule.state = "claimed";
    granule.claimedBy = workerId;
    granule.claimedAt = Date.now();

    return { success: true, granule: { ...granule } };
  }

  releaseGranule(granuleId: string, workerId: string): { success: boolean } {
    const granule = this.granules.get(granuleId);
    if (!granule) {
      return { success: false };
    }

    if (granule.state !== "claimed" || granule.claimedBy !== workerId) {
      return { success: false };
    }

    granule.state = "unclaimed";
    granule.claimedBy = undefined;
    granule.claimedAt = undefined;

    return { success: true };
  }

  completeGranule(granuleId: string, workerId: string, summary?: string): { success: boolean } {
    const granule = this.granules.get(granuleId);
    if (!granule) {
      return { success: false };
    }

    if (granule.state !== "claimed" || granule.claimedBy !== workerId) {
      return { success: false };
    }

    granule.state = "completed";
    granule.completedAt = Date.now();
    if (summary !== undefined) {
      granule.summary = summary;
    }

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
    return stale.length;
  }
}
