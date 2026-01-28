#!/usr/bin/env node
import { GranuleStore } from "./store.js";
import { Orchestrator } from "./orchestrator.js";

function parseArgs(): { prompt?: string } {
  const args = process.argv.slice(2);
  const result: { prompt?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-p" || args[i] === "--prompt") {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result.prompt = nextArg;
        i++;
      }
    }
  }

  return result;
}

async function main() {
  const { prompt } = parseArgs();
  const store = new GranuleStore();
  const orchestrator = new Orchestrator(store);

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
