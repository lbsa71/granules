import { describe, it, expect } from "vitest";
import { CLASS_PROMPTS } from "./worker.js";
import type { GranuleClass } from "./types.js";

describe("CLASS_PROMPTS", () => {
  const allClasses: GranuleClass[] = [
    "explore",
    "plan",
    "implement",
    "test",
    "review",
    "consolidate",
    "Implemented",
  ];

  it("has an entry for each GranuleClass", () => {
    for (const cls of allClasses) {
      expect(CLASS_PROMPTS[cls]).toBeDefined();
      expect(typeof CLASS_PROMPTS[cls]).toBe("string");
    }
  });

  it("has non-empty prompts for each class", () => {
    for (const cls of allClasses) {
      expect(CLASS_PROMPTS[cls].length).toBeGreaterThan(0);
    }
  });
});
