export type GranuleClass =
  | "explore"      // Understand codebase/context
  | "plan"         // Design implementation approach
  | "implement"    // Write/modify code (artifacts)
  | "test"         // Write or run tests
  | "review"       // Critique another worker's output
  | "consolidate"  // Merge work from multiple workers
  | "audit";       // Deferred architectural review (security, performance, maintainability)

export type GranuleState =
  | "unclaimed"    // Available for pickup
  | "claimed"      // Reserved by a worker
  | "completed";   // Finished

export interface Granule {
  id: string;           // "G-1", "G-2", auto-incremented
  class: GranuleClass;
  content: string;      // Task description
  contentHash: string;  // SHA-256 hash of content field
  state: GranuleState;
  claimedBy?: string;   // Worker ID, e.g., "W-1"
  claimedAt?: number;   // Unix timestamp ms
  createdAt: number;
  completedAt?: number;
  summary?: string;     // Completion summary, used for coordination
  retryCount?: number;  // Number of times this granule has been retried after failure
  lastError?: string;   // Last error message if worker failed
}

/** Store interface implemented by both in-memory and persistent stores. */
export interface Store {
  createGranule(class_: GranuleClass, content: string): Granule;
  listGranules(): Granule[];
  getGranule(id: string): Granule | undefined;
  claimGranule(granuleId: string, workerId: string): { success: boolean; granule?: Granule };
  releaseGranule(granuleId: string, workerId: string, error?: string): { success: boolean };
  completeGranule(granuleId: string, workerId: string, summary?: string): { success: boolean };
  getStaleClaims(maxAgeMs: number): Granule[];
  releaseStaleClaims(maxAgeMs: number): number;
  updateGranuleContent(granuleId: string, content: string): { success: boolean; granule?: Granule };
}
