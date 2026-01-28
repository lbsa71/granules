import type { GranuleClass } from "../types.js";
import { EXPLORE_PROMPT } from "./explore.js";
import { PLAN_PROMPT } from "./plan.js";
import { IMPLEMENT_PROMPT } from "./implement.js";
import { TEST_PROMPT } from "./test.js";
import { REVIEW_PROMPT } from "./review.js";
import { CONSOLIDATE_PROMPT } from "./consolidate.js";
import { AUDIT_PROMPT } from "./audit.js";

/** Class-specific instruction templates. Placeholders: {{workerId}}, {{granuleId}}, {{branchName}} */
export const CLASS_PROMPTS: Record<GranuleClass, string> = {
  explore: EXPLORE_PROMPT,
  plan: PLAN_PROMPT,
  implement: IMPLEMENT_PROMPT,
  test: TEST_PROMPT,
  review: REVIEW_PROMPT,
  consolidate: CONSOLIDATE_PROMPT,
  audit: AUDIT_PROMPT,
};
