import type { Granule } from "./types.js";

interface WorkerInfo {
  workerId: string;
  granuleId: string;
  granuleClass: string;
  granuleContent: string;
  startedAt: number;
}

interface UIState {
  workers: WorkerInfo[];
  granules: {
    unclaimed: number;
    claimed: number;
    completed: number;
    failed: number;
    total: number;
  };
  implementedReport?: string;
  inputLine: string;
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIdx = 0;

function truncate(str: string, maxLen: number): string {
  const singleLine = str.replace(/\n/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 1) + "…";
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function renderUI(state: UIState): void {
  const now = Date.now();
  const spinner = SPINNER[spinnerIdx++ % SPINNER.length];

  // Clear screen and move cursor to top
  process.stdout.write("\x1B[2J\x1B[H");

  // Header
  console.log("\x1B[1m\x1B[36m┌─────────────────────────────────────────────────────────────────────────────┐\x1B[0m");
  console.log("\x1B[1m\x1B[36m│\x1B[0m  \x1B[1m🔮 GRANULES ORCHESTRATOR\x1B[0m                                                   \x1B[1m\x1B[36m│\x1B[0m");
  console.log("\x1B[1m\x1B[36m└─────────────────────────────────────────────────────────────────────────────┘\x1B[0m");

  // Status report box (when implemented)
  if (state.implementedReport) {
    console.log();
    console.log("\x1B[1m\x1B[32m┌─ STATUS REPORT ──────────────────────────────────────────────────────────────\x1B[0m");
    const lines = state.implementedReport.split("\n");
    for (const line of lines.slice(0, 8)) {
      console.log(`\x1B[32m│\x1B[0m ${truncate(line, 75)}`);
    }
    if (lines.length > 8) {
      console.log(`\x1B[32m│\x1B[0m \x1B[2m... (${lines.length - 8} more lines)\x1B[0m`);
    }
    console.log("\x1B[1m\x1B[32m└──────────────────────────────────────────────────────────────────────────────\x1B[0m");
  }
  console.log();

  // Granule stats
  const { unclaimed, claimed, completed, failed, total } = state.granules;
  const implStatus = state.implementedReport ? "\x1B[32m✓ IMPLEMENTED\x1B[0m" : "\x1B[33m◌ in progress\x1B[0m";
  const failedStr = failed > 0 ? `  │  \x1B[31m${failed} failed\x1B[0m` : "";
  console.log(`\x1B[1mStatus:\x1B[0m ${implStatus}  │  \x1B[33m${unclaimed} queued\x1B[0m  │  \x1B[34m${claimed} claimed\x1B[0m  │  \x1B[32m${completed} done\x1B[0m${failedStr}  │  ${total} total`);
  console.log();

  if (state.workers.length === 0) {
    console.log("\x1B[2mNo active workers\x1B[0m");
  } else {
    console.log("\x1B[1mActive Workers:\x1B[0m");
    console.log("\x1B[2m─────────────────────────────────────────────────────────────────────────────\x1B[0m");

    for (const worker of state.workers) {
      const duration = formatDuration(now - worker.startedAt);
      const content = truncate(worker.granuleContent, 50);

      console.log(
        `  ${spinner} \x1B[1m\x1B[36m${worker.workerId}\x1B[0m  ` +
        `\x1B[2m${worker.granuleId}\x1B[0m  ` +
        `\x1B[33m[${worker.granuleClass}]\x1B[0m  ` +
        `\x1B[2m${duration}\x1B[0m`
      );
      console.log(`    \x1B[37m${content}\x1B[0m`);
      console.log();
    }
  }

  console.log("\x1B[2m─────────────────────────────────────────────────────────────────────────────\x1B[0m");
  console.log(`\x1B[1m>\x1B[0m ${state.inputLine}\x1B[7m \x1B[0m`);
  console.log("\x1B[2mType a task to add as granule, or 'exit' to quit\x1B[0m");
}

export class UIManager {
  private intervalId?: NodeJS.Timeout;
  private inputLine: string = "";
  private currentState: UIState = {
    workers: [],
    granules: { unclaimed: 0, claimed: 0, completed: 0, failed: 0, total: 0 },
    inputLine: "",
  };

  onCommand?: (command: string) => void;
  onExit?: () => void;

  start(): void {
    // Set up raw mode for character-by-character input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      if (key === "\u0003") {
        // Ctrl+C
        this.onExit?.();
        return;
      }

      if (key === "\r" || key === "\n") {
        // Enter
        const cmd = this.inputLine.trim();
        this.inputLine = "";
        this.currentState.inputLine = "";

        if (cmd.toLowerCase() === "exit") {
          this.onExit?.();
        } else if (cmd) {
          this.onCommand?.(cmd);
        }
        return;
      }

      if (key === "\u007F" || key === "\b") {
        // Backspace
        this.inputLine = this.inputLine.slice(0, -1);
        this.currentState.inputLine = this.inputLine;
        return;
      }

      // Regular character
      if (key.length === 1 && key >= " ") {
        this.inputLine += key;
        this.currentState.inputLine = this.inputLine;
      }
    });

    // Render every 200ms for smooth spinner animation
    this.intervalId = setInterval(() => {
      renderUI(this.currentState);
    }, 200);

    // Hide cursor
    process.stdout.write("\x1B[?25l");

    // Show cursor on exit
    process.on("exit", () => {
      process.stdout.write("\x1B[?25h");
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    // Show cursor and clear screen
    process.stdout.write("\x1B[?25h");
    process.stdout.write("\x1B[2J\x1B[H");
  }

  update(
    workers: Map<string, { workerId: string; granuleId: string; startedAt: number }>,
    granules: Granule[]
  ): void {
    const workerInfos: WorkerInfo[] = [];

    for (const worker of workers.values()) {
      const granule = granules.find((g) => g.id === worker.granuleId);
      workerInfos.push({
        workerId: worker.workerId,
        granuleId: worker.granuleId,
        granuleClass: granule?.class ?? "unknown",
        granuleContent: granule?.content ?? "",
        startedAt: worker.startedAt,
      });
    }

    const implemented = granules.find((g) => g.class === "Implemented");

    const MAX_RETRIES = 3;
    const failed = granules.filter((g) => g.state === "unclaimed" && (g.retryCount ?? 0) >= MAX_RETRIES).length;
    const unclaimed = granules.filter((g) => g.state === "unclaimed" && (g.retryCount ?? 0) < MAX_RETRIES).length;

    this.currentState = {
      workers: workerInfos,
      granules: {
        unclaimed,
        claimed: granules.filter((g) => g.state === "claimed").length,
        completed: granules.filter((g) => g.state === "completed").length,
        failed,
        total: granules.length,
      },
      implementedReport: implemented?.content,
      inputLine: this.inputLine,
    };
  }
}
