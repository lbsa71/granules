import type { GranuleStore } from "../store.js";

export function claimGranuleTool(store: GranuleStore) {
  return {
    name: "claim_granule",
    description: "Atomically claim a granule. Fails if already claimed.",
    inputSchema: {
      type: "object",
      properties: {
        granuleId: {
          type: "string",
        },
        workerId: {
          type: "string",
        },
      },
      required: ["granuleId", "workerId"],
    },
    handler: async (params: { granuleId: string; workerId: string }) => {
      return store.claimGranule(params.granuleId, params.workerId);
    },
  };
}
