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
Your task granule:
- ID: ${granule.id}
- Class: ${granule.class}
- Content: ${granule.content}

Connect to MCP server at http://localhost:3000

Instructions:
1. First, call claim_granule with your worker ID and granule ID
2. Do the work described in the content
3. You may call create_granule to spawn follow-up work
4. When done, call complete_granule with a brief summary

Available tools: list_granules, create_granule, claim_granule, release_granule, complete_granule`;
}
