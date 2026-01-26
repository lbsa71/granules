import { GranuleStore } from "./store.js";
import { startMCPServer } from "./server.js";
import { spawnWorker } from "./worker.js";
import type { ChildProcess } from "child_process";

const MAX_WORKERS = 3;
const LOOP_INTERVAL_MS = 5000;
const STALE_CLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface ActiveWorker {
  workerId: string;
  granuleId: string;
  process: ChildProcess;
  startedAt: number;
}

export class Orchestrator {
  private store: GranuleStore;
  private activeWorkers: Map<string, ActiveWorker> = new Map();
  private nextWorkerId: number = 1;
  private loopInterval?: NodeJS.Timeout;
  private serverStarted: boolean = false;

  constructor(store: GranuleStore) {
    this.store = store;
  }

  async start(): Promise<void> {
    // Start MCP server
    if (!this.serverStarted) {
      await startMCPServer(this.store);
      this.serverStarted = true;
    }

    // Bootstrap: create plan granule if none exist
    const granules = this.store.listGranules();
    if (granules.length === 0) {
      this.store.createGranule(
        "plan",
        "Read README.md and plan the implementation of GRANULES"
      );
      console.log("Created bootstrap plan granule");
    }

    // Start main loop
    this.loopInterval = setInterval(() => {
      this.tick();
    }, LOOP_INTERVAL_MS);

    // Run first tick immediately
    this.tick();

    console.log("Orchestrator started");
  }

  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = undefined;
    }

    // Terminate all active workers
    for (const worker of this.activeWorkers.values()) {
      try {
        worker.process.kill();
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
    this.activeWorkers.clear();

    console.log("Orchestrator stopped");
  }

  private tick(): void {
    // Release stale claims
    const released = this.store.releaseStaleClaims(STALE_CLAIM_TIMEOUT_MS);
    if (released > 0) {
      console.log(`Released ${released} stale claim(s)`);
    }

    // Clean up completed workers
    this.cleanupCompletedWorkers();

    // Get unclaimed granules
    const unclaimed = this.store.listGranules().filter((g) => g.state === "unclaimed");

    // Spawn workers for unclaimed granules (up to MAX_WORKERS)
    const availableSlots = MAX_WORKERS - this.activeWorkers.size;
    const toSpawn = Math.min(availableSlots, unclaimed.length);

    for (let i = 0; i < toSpawn; i++) {
      const granule = unclaimed[i];
      this.spawnWorkerForGranule(granule.id);
    }

    // Log state
    this.logState();
  }

  private cleanupCompletedWorkers(): void {
    const toRemove: string[] = [];

    for (const [workerId, worker] of this.activeWorkers.entries()) {
      if (worker.process.killed || worker.process.exitCode !== null) {
        toRemove.push(workerId);
      }
    }

    for (const workerId of toRemove) {
      this.activeWorkers.delete(workerId);
    }
  }

  private spawnWorkerForGranule(granuleId: string): void {
    const workerId = `W-${this.nextWorkerId++}`;
    const granule = this.store.getGranule(granuleId);

    if (!granule) {
      console.error(`Granule ${granuleId} not found`);
      return;
    }

    try {
      const process = spawnWorker(workerId, granule);
      const activeWorker: ActiveWorker = {
        workerId,
        granuleId,
        process,
        startedAt: Date.now(),
      };

      this.activeWorkers.set(workerId, activeWorker);

      // Handle process completion
      process.on("exit", (code) => {
        this.activeWorkers.delete(workerId);
        console.log(`Worker ${workerId} exited with code ${code}`);
      });

      process.on("error", (error) => {
        console.error(`Worker ${workerId} error:`, error);
        this.activeWorkers.delete(workerId);
      });

      console.log(`Spawned worker ${workerId} for granule ${granuleId}`);
    } catch (error) {
      console.error(`Failed to spawn worker ${workerId}:`, error);
    }
  }

  private logState(): void {
    const granules = this.store.listGranules();
    const unclaimed = granules.filter((g) => g.state === "unclaimed").length;
    const claimed = granules.filter((g) => g.state === "claimed").length;
    const completed = granules.filter((g) => g.state === "completed").length;

    console.log(
      `[Orchestrator] Granules: ${unclaimed} unclaimed, ${claimed} claimed, ${completed} completed | Active workers: ${this.activeWorkers.size}`
    );
  }
}
