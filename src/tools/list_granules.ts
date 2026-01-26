import type { GranuleStore } from "../store.js";

export function listGranulesTool(store: GranuleStore) {
  return {
    name: "list_granules",
    description: "Get all granules",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      return store.listGranules();
    },
  };
}
