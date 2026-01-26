import type { GranuleStore } from "../store.js";
import { listGranulesTool } from "./list_granules.js";
import { createGranuleTool } from "./create_granule.js";
import { claimGranuleTool } from "./claim_granule.js";
import { releaseGranuleTool } from "./release_granule.js";
import { completeGranuleTool } from "./complete_granule.js";

export function getTools(store: GranuleStore) {
  return [
    listGranulesTool(store),
    createGranuleTool(store),
    claimGranuleTool(store),
    releaseGranuleTool(store),
    completeGranuleTool(store),
  ];
}
