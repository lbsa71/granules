import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Granule } from "./types.js";

/** Hardcoded default path for claude. Override with GRANULES_WORKER_CMD. */
const CLAUDE_PATH = "/Users/stefan/.local/bin/claude";

export function spawnWorker(workerId: string, granule: Granule): ChildProcess {
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

  // Avoid huge argv (ARG_MAX): write invoker script to temp file, run shell -l <script>.
  const shell = process.env.SHELL || "/bin/bash";
  const claudeExe = workerCmd.split(/\s+/)[0]!;
  const extra = workerCmd.split(/\s+/).slice(1);
  const esc = (s: string) => s.replace(/'/g, "'\"'\"'");
  const scriptPath = join(tmpdir(), `granules-${workerId}-${Date.now()}.sh`);
  const extraArg = extra.length ? " " + extra.map((a) => "'" + esc(a) + "'").join(" ") : "";
  const scriptBody = `#!${shell}
exec '${esc(claudeExe)}'${extraArg} --model sonnet --mcp-config ./mcp-config.json --output-format json -p '${esc(prompt)}'
`;
  writeFileSync(scriptPath, scriptBody, { mode: 0o700 });

  let output = "";

  streamLog.write(`[${iso()}] Spawning: ${shell} -l ${scriptPath}\n`);
  const cp = spawn(shell, ["-l", scriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(),
    env: { ...process.env },
  });

  cp.stdout?.on("data", (d: Buffer) => {
    const s = d.toString();
    output += s;
    streamLog.write(s);
  });
  cp.stderr?.on("data", (d: Buffer) => {
    const s = d.toString();
    output += s;
    streamLog.write(s);
  });

  cp.on("exit", (code, signal) => {
    try {
      unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
    streamLog.write(`\n[${iso()}] Process exited${code != null ? ` with code ${code}` : signal ? ` (signal ${signal})` : ""}\n`);
    streamLog.end();
    writeLog({ output, exitedAt: Date.now(), exitCode: code ?? undefined });
  });

  cp.on("error", (err) => {
    try {
      unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
    const msg = String(err);
    streamLog.write(`[${iso()}] Process error: ${msg}\n`);
    streamLog.end();
    writeLog({ output, error: msg, exitedAt: Date.now() });
  });

  return cp;
}

function generateWorkerPrompt(workerId: string, granule: Granule): string {
  return `You are Worker ${workerId}.

Your task is to implement the following item of work, called a 'granule':
- ID: ${granule.id}
- Class: ${granule.class}
- Content: ${granule.content}

CRITICAL: Execute tools ONE AT A TIME. Never make multiple tool calls in a single turn.

Instructions:
1. Familiarize yourself with the project and the codebase as needed.
2. Verify that the granule is valid and whether you agree that the content is a valid task to be implemented.
3. If you are not able to complete the work, call release_granule with your worker ID and granule ID, and exit.
4. If you agree to implementing the work, call claim_granule with your worker ID and granule ID.
5. If the work consists of file artifact changes:
   a. git checkout a new branch for the work. This should be called "worker-${workerId}-granule-${granule.id}".
   b. Identify the smallest set of changes that are necessary to complete the work.
   c. Make the changes in a TDD manner; test for the negative, then implement the positive.
   d. Refactor and restructure as necessary. Create followup granules if necessary.
   e. git add, commit, and push the changes.
   f. Call create_granule to spawn a consolidate granule with the content 'Fold branch "worker-${workerId}-granule-${granule.id}" into main, solving conflicts as necessary.'.
6. All other work, such as planning, architecting, review, critique and other non-filesystem changes:
   a. Identify the smallest set of changes that are necessary to complete the work.
   b. Post a new granule containing the identified needed change.
7. When done, call complete_granule with a brief summary of the work done.

Available MCP tools: list_granules, create_granule, claim_granule, release_granule, complete_granule`;
}
