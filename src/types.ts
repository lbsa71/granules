export type GranuleClass =
  | "explore"      // Understand codebase/context
  | "plan"         // Design implementation approach
  | "implement"    // Write/modify code (artifacts)
  | "test"         // Write or run tests
  | "review"       // Critique another worker's output
  | "consolidate"  // Merge work from multiple workers
  | "Implemented"; // Exit condition: orchestrator stops and outputs content as final report

export type GranuleState =
  | "unclaimed"    // Available for pickup
  | "claimed"      // Reserved by a worker
  | "completed";   // Finished

export interface Granule {
  id: string;           // "G-1", "G-2", auto-incremented
  class: GranuleClass;
  content: string;      // Task description
  state: GranuleState;
  claimedBy?: string;   // Worker ID, e.g., "W-1"
  claimedAt?: number;   // Unix timestamp ms
  createdAt: number;
  completedAt?: number;
  summary?: string;     // Completion summary, used for coordination
}
