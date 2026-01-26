import type { ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, createWriteStream } from "fs";
import { createRequire } from "module";
import { join } from "path";
import type { Granule } from "./types.js";

const require = createRequire(import.meta.url);

/** Hardcoded default path for claude. Override with GRANULES_WORKER_CMD. */
const CLAUDE_PATH = "/Users/stefan/.local/bin/claude";

const pty = require("node-pty") as {
  spawn(
    file: string,
    args: string[],
    opts: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> }
  ): { onData(cb: (data: string) => void): void; onExit(cb: (e: { exitCode: number; signal?: number }) => void): void; kill(signal?: string): void };
};

/** Adapter so orchestrator can treat our pty like a ChildProcess. */
interface ProcessAdapter {
  on(event: string, handler: (...args: unknown[]) => void): void;
  kill(signal?: string): void;
  exitCode: number | null;
  killed: boolean;
}

export function spawnWorker(workerId: string, granule: Granule): ChildProcess & ProcessAdapter {
  // Ensure logs directory exists
  const logsDir = join(process.cwd(), "logs");
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }

  // Generate worker prompt
  const prompt = generateWorkerPrompt(workerId, granule);

  // Log paths: .json for final metadata, .log for streaming (tail -f)
  const logJsonPath = join(logsDir, `worker-${workerId}.json`);
  const logStreamPath = join(logsDir, `worker-${workerId}.log`);
  const startedAt = Date.now();

  const streamLog = createWriteStream(logStreamPath, { flags: "w" });
  const iso = () => new Date().toISOString();
  const workerCmd = process.env.GRANULES_WORKER_CMD?.trim() || CLAUDE_PATH;
  streamLog.write(`[${iso()}] Worker ${workerId} started for granule ${granule.id}\n`);
  streamLog.write(`[${iso()}] Using claude at: ${workerCmd}\n`);

  function writeLog(extra: { output?: string; error?: string; exitedAt?: number; exitCode?: number | null }) {
    try {
      writeFileSync(
        logJsonPath,
        JSON.stringify({ workerId, granuleId: granule.id, startedAt, ...extra }, null, 2),
        { flag: "w" }
      );
    } catch (e) {
      console.error(`Failed to write log file for ${workerId}:`, e);
    }
  }

  writeLog({ output: "" });

  // GRANULES_WORKER_CMD overrides; otherwise CLAUDE_PATH
  const cmdSpec = workerCmd;
  const cmdParts = cmdSpec.split(/\s+/);
  const executable = cmdParts[0]!;
  const leadingArgs = cmdParts.length > 1 ? cmdParts.slice(1) : [];

  const args = [
    ...leadingArgs,
    "--mcp-config", "./mcp-config.json",
    "--output-format", "json",
    "-p", prompt,
  ];

  let output = "";
  let exitCode: number | null = null;
  let killed = false;
  const exitListeners: ((code: number | null) => void)[] = [];
  const errorListeners: ((err: Error) => void)[] = [];
  type PtyHandle = { onData(cb: (data: string) => void): void; onExit(cb: (e: { exitCode: number; signal?: number }) => void): void; kill(signal?: string): void };
  let ptyProcess: PtyHandle | null = null;

  try {
    ptyProcess = pty.spawn(executable, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    ptyProcess.onData((data: string) => {
      output += data;
      streamLog.write(data);
    });

    ptyProcess.onExit((e: { exitCode: number; signal?: number }) => {
      exitCode = e.exitCode;
      streamLog.write(`\n[${iso()}] Process exited with code ${e.exitCode}\n`);
      streamLog.end();
      writeLog({ output, exitedAt: Date.now(), exitCode: e.exitCode });
      exitListeners.forEach((cb) => cb(e.exitCode));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    streamLog.write(`[${iso()}] Spawn error: ${msg}\n`);
    streamLog.end();
    writeLog({ output: "", error: msg, exitedAt: Date.now() });
    errorListeners.forEach((cb) => cb(err instanceof Error ? err : new Error(msg)));
  }

  const adapter: ProcessAdapter = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "exit") exitListeners.push(handler as (code: number | null) => void);
      if (event === "error") errorListeners.push(handler as (err: Error) => void);
    },
    kill(signal?: string) {
      killed = true;
      ptyProcess?.kill(signal);
    },
    get exitCode() {
      return exitCode;
    },
    get killed() {
      return killed;
    },
  };

  return adapter as ChildProcess & ProcessAdapter;
}

function generateWorkerPrompt(workerId: string, granule: Granule): string {
  return `You are Worker ${workerId}.
Your task is to implement the following item of work, called a 'granule':
- ID: ${granule.id}
- Class: ${granule.class}
- Content: ${granule.content}

Connect to MCP server at http://localhost:3000

Instructions:
1. First, switch to and git pull the latest main branch from the repository.
2. Familiarize yourself with the project and the codebase.
3. Verify that the granule is valid and whether you agree that the content is a valid task to be implemented.
4. If you do not agree, call delete_granule with your worker ID and granule ID, and exit.
5. If you are not able to complete the work, call release_granule with your worker ID and granule ID, and exit.
6. If you agree to implementing the work, call claim_granule with your worker ID and granule ID
7. If the work consists of file artifact changes, 
  1. git checkout a new branch for the work. This should be called "worker-${workerId}-granule-${granule.id}".
  2. Identify the smallest set of changes that are necessary to complete the work.
  3. Make the changes in a TDD manner; test for the negative, then implement the positive.
  4. Refactor and restructure as necessary. Create followup granules if necessary.
  5. git add, commit, and push the changes.
  6. Call create_granule to spawn a consolidate granule with the content 'Fold branch "worker-${workerId}-granule-${granule.id}" into main, solving conflicts as necessary.'.
8. All other work, such as planning, architecting, review, critique and other non-filesystem changes,
  1. Identify the smallest set of change that are necessary to complete the work.
  2. Post a new granule containing the identified needed change. 
9. When done, call complete_granule with a brief summary of the work done.`;
}
