import { GranuleStore } from "./store.js";
import { Orchestrator } from "./orchestrator.js";

async function main() {
  const store = new GranuleStore();
  const orchestrator = new Orchestrator(store);

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
