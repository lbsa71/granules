import { spawn, execSync, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, createWriteStream, unlinkSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Granule, GranuleClass } from "./types.js";

/** Class-specific instruction templates. Placeholders: {{workerId}}, {{granuleId}}, {{branchName}} */
export const CLASS_PROMPTS: Record<GranuleClass, string> = {
  explore: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, explore the codebase to understand its structure, patterns, and dependencies.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Document your findings clearly. Create granules for any areas needing deeper investigation.
5. If you cannot complete the exploration, release the granule back to the queue and exit.
6. Create granules for any follow-up work identified during exploration (implementation tasks, documentation gaps, etc.).
7. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.
8. When done, mark the granule as complete with a summary of your findings and the list of granules you created.`,

  plan: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the relevant parts of the codebase.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Design a clear implementation approach. Break the work into discrete, testable steps.
5. If you cannot create a viable plan, release the granule back to the queue and exit.
6. Create granules for each implementation step identified in your plan. Each granule should be small and focused.
7. BEFORE marking complete: Verify you have created granules for ALL planned implementation steps. A plan without actionable granules is a failure mode.
8. When done, mark the granule as complete with a summary of your plan and the list of granules you created.`,

  implement: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the codebase as needed.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Verify that the granule is valid and whether you agree that the content is a valid task to be implemented.
5. If you are not able to complete the work, release the granule back to the queue and exit.
6. Implement the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Identify the smallest set of changes that are necessary to complete the work.
   c. Make the changes in a TDD manner; test for the negative, then implement the positive.
   d. Refactor and restructure as necessary.
   e. git add and commit your changes.
   f. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any follow-up work identified during implementation.
8. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a brief summary including the list of granules you created.`,

  test: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the code being tested and the existing test patterns.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Verify that the granule is valid and the testing scope is clear.
5. If you are not able to complete the work, release the granule back to the queue and exit.
6. Write and run tests:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Write comprehensive tests covering edge cases. Ensure tests are isolated and deterministic.
   c. Run the tests to verify they pass.
   d. git add and commit your changes.
   e. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any bugs found or additional test coverage needed.
8. BEFORE marking complete: Verify you have created granules for ALL identified issues or gaps. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a summary of test results and the list of granules you created.`,

  review: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the code or work to be reviewed.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Review the work thoroughly. Check for bugs, style issues, missed edge cases, and adherence to project patterns.
5. If you cannot complete the review, release the granule back to the queue and exit.
6. Provide constructive feedback. Create granules for any issues that need to be addressed.
7. BEFORE marking complete: Verify you have created granules for ALL identified issues. Listing problems without creating granules is a failure mode.
8. When done, mark the granule as complete with a summary of your review findings and the list of granules you created.`,

  consolidate: `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the related work items to be consolidated.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Merge related work items. Resolve any conflicts. Ensure consistency across changes.
5. If you cannot complete the consolidation, release the granule back to the queue and exit.
6. Consolidate the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Merge the relevant work, resolving conflicts as needed.
   c. Ensure consistency and coherence across the consolidated changes.
   d. git add and commit your changes.
   e. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any follow-up work identified during consolidation.
8. BEFORE marking complete: Verify you have created granules for ALL identified gaps or issues. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a summary of what was consolidated and the list of granules you created.`,

  Implemented: `This granule represents completed work. No action is required.
If you have claimed this granule in error, release it immediately.`,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");

/** Hardcoded default path for claude. Override with GRANULES_WORKER_CMD. */
const CLAUDE_PATH = "/Users/stefan/.local/bin/claude";

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
