import type { GranuleStore } from "../store.js";

export function releaseGranuleTool(store: GranuleStore) {
  return {
    name: "release_granule",
    description: "Release a claimed granule",
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
      return store.releaseGranule(params.granuleId, params.workerId);
    },
  };
}
