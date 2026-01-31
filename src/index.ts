#!/usr/bin/env node
import { readFileSync } from "fs";
import { GranuleStore } from "./store.js";
import { FileStore } from "./file-store.js";
import { Orchestrator } from "./orchestrator.js";
import type { Store } from "./types.js";

interface GranulesConfig {
  store?: "memory" | "file";
  stateFile?: string;
  port?: number;
  maxWorkers?: number;
  exitOnIdle?: boolean;
}

function loadConfig(): GranulesConfig {
  try {
    const data = readFileSync(".granules.json", "utf-8");
    return JSON.parse(data) as GranulesConfig;
  } catch {
    return {};
  }
}

function parseArgs(): { prompt?: string; store?: string; stateFile?: string; port?: number; maxWorkers?: number; exitOnIdle?: boolean } {
  const args = process.argv.slice(2);
  const result: { prompt?: string; store?: string; stateFile?: string; port?: number; maxWorkers?: number; exitOnIdle?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === "-p" || arg === "--prompt") && next && !next.startsWith("-")) {
      result.prompt = next;
      i++;
    } else if (arg === "--store" && next) {
      result.store = next;
      i++;
    } else if (arg === "--state-file" && next) {
      result.stateFile = next;
      i++;
    } else if (arg === "--port" && next) {
      result.port = Number(next);
      i++;
    } else if (arg === "--max-workers" && next) {
      result.maxWorkers = Number(next);
      i++;
    } else if (arg === "--exit-on-idle") {
      result.exitOnIdle = true;
    }
  }

  return result;
}

async function main() {
  const config = loadConfig();
  const flags = parseArgs();

  // CLI flags override config file
  const storeType = flags.store ?? config.store ?? "memory";
  const stateFile = flags.stateFile ?? config.stateFile ?? ".granules-state.json";
  const port = flags.port ?? config.port;
  const prompt = flags.prompt;

  // Set port env var if specified (used by server.ts)
  if (port !== undefined) {
    process.env.PORT = String(port);
  }

  let store: Store;
  if (storeType === "file") {
    store = new FileStore(stateFile);
  } else {
    store = new GranuleStore();
  }

  const exitOnIdle = flags.exitOnIdle ?? config.exitOnIdle ?? false;
  const orchestrator = new Orchestrator(store, { exitOnIdle });

  // Setup graceful shutdown handlers
  const shutdown = () => {
    orchestrator.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    await orchestrator.start(prompt);
  } catch (error) {
    console.error("Failed to start orchestrator:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
