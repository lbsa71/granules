import { describe, it, expect } from "vitest";
import { CLASS_PROMPTS } from "./prompts/index.js";
import type { GranuleClass } from "./types.js";

describe("CLASS_PROMPTS", () => {
  const allClasses: GranuleClass[] = [
    "explore",
    "plan",
    "implement",
    "test",
    "review",
    "consolidate",
    "audit",
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

  it("includes workerId and granuleId placeholders for actionable classes", () => {
    const actionableClasses: GranuleClass[] = ["explore", "plan", "implement", "test", "review", "consolidate"];
    for (const cls of actionableClasses) {
      expect(CLASS_PROMPTS[cls]).toContain("{{workerId}}");
      expect(CLASS_PROMPTS[cls]).toContain("{{granuleId}}");
    }
  });

  it("includes branchName placeholder for classes that modify files", () => {
    const fileModifyingClasses: GranuleClass[] = ["implement", "test", "consolidate"];
    for (const cls of fileModifyingClasses) {
      expect(CLASS_PROMPTS[cls]).toContain("{{branchName}}");
    }
  });
});
