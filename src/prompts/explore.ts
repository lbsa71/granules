export const EXPLORE_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS:
   TIER 1: CLAUDE.md, CONSTRAINTS.md
   TIER 2: README.md, ARCHITECTURE.md, all /domain/*.md

3. Explore the codebase to understand its structure, patterns, dependencies, and domain.

4. ARTIFACT GAP ANALYSIS: Identify which project artifacts are missing or incomplete:
   - Is CONSTRAINTS.md present with grep-able forbidden patterns?
   - Do /domain/*.md docs exist for all domain areas?
   - Are /spec/*.md files present and current?
   - Does PROGRESS.md reflect actual project state?
   - Are /reference/*.md golden files available?
   - Does CLAUDE.md have tiered document loading and quality gates?

5. Document your findings clearly. Create granules for:
   - Missing or incomplete artifacts
   - Areas needing deeper investigation
   - Architectural concerns or technical debt
   - Domain knowledge gaps that need research

6. If you cannot complete the exploration, release the granule back to the queue and exit.

7. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.

8. When done, mark the granule as complete with a summary of your findings and the list of granules you created.`;
