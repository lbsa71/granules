import type { GranuleStore } from "../store.js";
import type { GranuleClass } from "../types.js";

export function createGranuleTool(store: GranuleStore) {
  return {
    name: "create_granule",
    description: "Create new granule",
    inputSchema: {
      type: "object",
      properties: {
        class: {
          type: "string",
          enum: ["explore", "plan", "implement", "test", "review", "consolidate"],
        },
        content: {
          type: "string",
        },
      },
      required: ["class", "content"],
    },
    handler: async (params: { class: GranuleClass; content: string }) => {
      return store.createGranule(params.class, params.content);
    },
  };
}
