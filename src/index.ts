import { GranuleStore } from "./store.js";
import { Orchestrator } from "./orchestrator.js";

async function main() {
  const store = new GranuleStore();
  const orchestrator = new Orchestrator(store);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down gracefully...");
    orchestrator.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, shutting down gracefully...");
    orchestrator.stop();
    process.exit(0);
  });

  try {
    await orchestrator.start();
  } catch (error) {
    console.error("Failed to start orchestrator:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
