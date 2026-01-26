import type { GranuleStore } from "../store.js";

export function completeGranuleTool(store: GranuleStore) {
  return {
    name: "complete_granule",
    description: "Mark a granule as completed",
    inputSchema: {
      type: "object",
      properties: {
        granuleId: {
          type: "string",
        },
        workerId: {
          type: "string",
        },
        summary: {
          type: "string",
        },
      },
      required: ["granuleId", "workerId"],
    },
    handler: async (params: { granuleId: string; workerId: string; summary?: string }) => {
      return store.completeGranule(params.granuleId, params.workerId, params.summary);
    },
  };
}
