import { GranuleStore } from "./store.js";
import { startMcpHttpServer } from "./server.js";
import { spawnWorker } from "./worker.js";
import { UIManager } from "./ui.js";
import { SessionLog } from "./session-log.js";
import type { ChildProcess } from "child_process";
import { readdirSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

const MAX_WORKERS = 3;
const LOOP_INTERVAL_MS = 5000;
const STALE_CLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 3;

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
  private ui: UIManager;
  private sessionLog: SessionLog;

  constructor(store: GranuleStore) {
    this.store = store;
    this.ui = new UIManager();
    this.sessionLog = new SessionLog(join(process.cwd(), "logs", "sessions.json"));

    // Handle user input from REPL
    this.ui.onCommand = (command: string) => {
      this.store.createGranule("implement", command);
    };

    this.ui.onExit = () => {
      this.stop();
      process.exit(0);
    };
  }

  async start(initialPrompt?: string): Promise<void> {
    // Clean up old logs
    this.cleanupLogs();

    // Start MCP server
    if (!this.serverStarted) {
      await startMcpHttpServer(this.store);
      this.serverStarted = true;
    }

    // Bootstrap: create initial granule if none exist
    if (this.store.listGranules().length === 0) {
      if (initialPrompt) {
        // Use provided prompt as initial granule
        this.store.createGranule("implement", initialPrompt);
      } else {
        // Default bootstrap granule
        this.store.createGranule(
          "plan",
          "Read README.md and perform a gap analysis of the project. If the project is complete, create a new granule with the class 'audit' and the content containing an assessment of the project."
        );
      }
    }

    // Start UI
    this.ui.start();

    // Start main loop
    this.loopInterval = setInterval(() => {
      this.tick();
    }, LOOP_INTERVAL_MS);

    // Run first tick immediately
    this.tick();
  }

  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = undefined;
    }

    // Stop UI
    this.ui.stop();

    // Terminate all active workers
    for (const worker of this.activeWorkers.values()) {
      try {
        worker.process.kill();
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
    this.activeWorkers.clear();
  }

  private cleanupLogs(): void {
    const logsDir = join(process.cwd(), "logs");
    try {
      mkdirSync(logsDir, { recursive: true });
      const files = readdirSync(logsDir);
      for (const file of files) {
        if (file.startsWith("worker-")) {
          unlinkSync(join(logsDir, file));
        }
      }
    } catch {
      // Ignore log cleanup errors
    }
  }

  private tick(): void {
    // Release stale claims
    this.store.releaseStaleClaims(STALE_CLAIM_TIMEOUT_MS);

    // Clean up completed workers
    this.cleanupCompletedWorkers();

    const granules = this.store.listGranules();

    // Granules that already have a worker assigned (avoid spawning twice for same granule)
    const assignedGranuleIds = new Set(
      [...this.activeWorkers.values()].map((w) => w.granuleId)
    );

    // Get unclaimed granules (skip ones that exceeded max retries)
    const nonauditUnclaimed = granules.filter(
      (g) =>
        g.state === "unclaimed" &&
        g.class !== "audit" &&
        !assignedGranuleIds.has(g.id) &&
        (g.retryCount ?? 0) < MAX_RETRIES
    );

    // Defer audit granules: only spawnable when no other unclaimed work exists
    // and no other work is in progress
    const hasOtherWork =
      nonauditUnclaimed.length > 0 ||
      this.activeWorkers.size > 0 ||
      granules.some((g) => g.state === "claimed");

    const auditUnclaimed = granules.filter(
      (g) =>
        g.state === "unclaimed" &&
        g.class === "audit" &&
        !assignedGranuleIds.has(g.id) &&
        (g.retryCount ?? 0) < MAX_RETRIES
    );

    const spawnableGranules = hasOtherWork
      ? nonauditUnclaimed
      : [...nonauditUnclaimed, ...auditUnclaimed];

    // Spawn workers for unclaimed granules (up to MAX_WORKERS)
    const availableSlots = MAX_WORKERS - this.activeWorkers.size;
    const toSpawn = Math.min(availableSlots, spawnableGranules.length);

    for (let i = 0; i < toSpawn; i++) {
      const granule = spawnableGranules[i];
      this.spawnWorkerForGranule(granule.id);
    }

    // Update UI
    this.ui.update(this.activeWorkers, granules);
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

    // Start session when first worker is spawned
    if (this.activeWorkers.size === 0) {
      this.sessionLog.startSession();
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
        // If worker exited with error, release the granule for retry
        if (code !== 0) {
          this.store.releaseGranule(granuleId, workerId, `Worker exited with code ${code}`);
        }
      });

      process.on("error", (err) => {
        this.activeWorkers.delete(workerId);
        // Release granule on spawn error
        this.store.releaseGranule(granuleId, workerId, `Worker error: ${err.message}`);
      });
    } catch (err) {
      // Worker spawn failed - release granule
      const msg = err instanceof Error ? err.message : String(err);
      this.store.releaseGranule(granuleId, workerId, `Spawn failed: ${msg}`);
    }
  }
}
