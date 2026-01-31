export const REVIEW_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS:
   TIER 1: CLAUDE.md, CONSTRAINTS.md, CONTRIBUTING.md
   TIER 3: /spec/*.md referenced by the work under review, relevant /domain/*.md

3. Review the work thoroughly:
   a. **Correctness**: Does the implementation satisfy the spec's Acceptance Criteria?
   b. **Convention adherence**: Does it follow CONSTRAINTS.md and CONTRIBUTING.md?
   c. **Domain accuracy**: Is domain logic consistent with /domain/*.md?
   d. **Edge cases**: Are boundary conditions and error paths handled?
   e. **Semantic consistency**: Does it integrate cleanly with existing code patterns?
   f. **Test quality**: Are tests following Arrange-Act-Assert (AAA)? Do they test behavior, not implementation details?

4. FORBIDDEN PATTERN CHECK: Search for violations of CONSTRAINTS.md forbidden patterns in the changed code.

5. If you cannot complete the review, release the granule back to the queue and exit.

6. Provide constructive feedback. Create granules for any issues that need to be addressed.

7. BEFORE marking complete: Verify you have created granules for ALL identified issues. Listing problems without creating granules is a failure mode.

8. When done, mark the granule as complete with a summary of your review findings and the list of granules you created.`;
