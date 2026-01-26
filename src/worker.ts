import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Granule } from "./types.js";

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

  // Log file path
  const logFile = join(logsDir, `worker-${workerId}.json`);

  // Spawn Claude CLI process
  const args = [
    "--mcp-config",
    "./mcp-config.json",
    "--output-format",
    "json",
    "-p",
    prompt,
  ];

  const childProcess = spawn("claude", args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Collect output for logging
  let output = "";
  
  childProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  childProcess.stderr.on("data", (data) => {
    output += data.toString();
  });

  childProcess.on("exit", () => {
    try {
      writeFileSync(logFile, output, { flag: "w" });
    } catch (error) {
      console.error(`Failed to write log file for ${workerId}:`, error);
    }
  });

  return childProcess;
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
