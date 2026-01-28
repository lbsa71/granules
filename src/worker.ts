import { spawn, execSync, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, createWriteStream, unlinkSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Granule } from "./types.js";
import { CLASS_PROMPTS } from "./prompts/index.js";

export { CLASS_PROMPTS };

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");

/** Default claude command. Relies on PATH lookup. Override with GRANULES_WORKER_CMD. */
const CLAUDE_PATH = "claude";

const MODELS = ["opus", "sonnet", "haiku"];

function getModelForRetry(retryCount: number): string {
  return MODELS[retryCount % MODELS.length] ?? "opus";
}

export function spawnWorker(workerId: string, granule: Granule): ChildProcess {
  const model = getModelForRetry(granule.retryCount ?? 0);
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
  streamLog.write(`[${iso()}] Model: ${model} (retry ${granule.retryCount ?? 0})\n`);

  // Create git worktree for isolated working directory
  const branchName = `worker-${workerId}-granule-${granule.id}`;
  const worktreesDir = join(process.cwd(), ".worktrees");
  const worktreePath = join(worktreesDir, branchName);
  try {
    mkdirSync(worktreesDir, { recursive: true });
    // Prune stale worktrees before creating new one
    execSync(`git worktree prune`, { cwd: process.cwd(), stdio: "pipe" });
    execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    streamLog.write(`[${iso()}] Created worktree at: ${worktreePath}\n`);
  } catch (err) {
    streamLog.write(`[${iso()}] Failed to create worktree: ${err}\n`);
    streamLog.end();
    throw err;
  }

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
  const mcpConfigPath = join(PACKAGE_ROOT, "mcp-config.json");
  const scriptBody = `#!${shell}
exec '${esc(claudeExe)}'${extraArg} --model ${model} --mcp-config '${esc(mcpConfigPath)}' --dangerously-skip-permissions --verbose --output-format stream-json --include-partial-messages -p '${esc(prompt)}'
`;
  writeFileSync(scriptPath, scriptBody, { mode: 0o700 });

  let output = "";

  streamLog.write(`[${iso()}] Spawning: ${shell} -l ${scriptPath}\n`);
  const cp = spawn(shell, ["-l", scriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: worktreePath,
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

  const cleanup = () => {
    try {
      unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
    // Remove worktree - worker may have already deleted the branch, so just force-remove directory and prune
    try {
      rmSync(worktreePath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    try {
      execSync(`git worktree prune`, { cwd: process.cwd(), stdio: "pipe" });
    } catch {
      /* ignore */
    }
    // Clean up branch if it still exists
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: process.cwd(), stdio: "pipe" });
    } catch {
      /* branch already deleted by worker, ignore */
    }
  };

  cp.on("exit", (code, signal) => {
    cleanup();
    streamLog.write(`\n[${iso()}] Process exited${code != null ? ` with code ${code}` : signal ? ` (signal ${signal})` : ""}\n`);
    streamLog.end();
    writeLog({ output, exitedAt: Date.now(), exitCode: code ?? undefined });
  });

  cp.on("error", (err) => {
    cleanup();
    const msg = String(err);
    streamLog.write(`[${iso()}] Process error: ${msg}\n`);
    streamLog.end();
    writeLog({ output, error: msg, exitedAt: Date.now() });
  });

  return cp;
}

function generateWorkerPrompt(workerId: string, granule: Granule): string {
  const branchName = `worker-${workerId}-granule-${granule.id}`;
  const instructions = CLASS_PROMPTS[granule.class]
    .replace(/\{\{workerId\}\}/g, workerId)
    .replace(/\{\{granuleId\}\}/g, granule.id)
    .replace(/\{\{branchName\}\}/g, branchName);

  return `You are Worker ${workerId}.

Your task is to complete the following granule:
- ID: ${granule.id}
- Class: ${granule.class}
- Content: ${granule.content}

${instructions}

You have access to the granule management system which allows you to:
- List all available granules in the work queue
- Create new granules to spawn follow-up work items
- Claim a granule to indicate you are working on it
- Release a granule if you cannot complete the work
- Complete a granule with a summary when finished`;
}
