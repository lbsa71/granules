export const IMPLEMENT_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS (Tiered — read in order):
   TIER 1 — Constraints & Standards (ALWAYS read):
   - CLAUDE.md — Work modes, quality gates, forbidden patterns
   - CONSTRAINTS.md — Hard rules, invariants, grep-able forbidden patterns. Check EVERY change against these.
   - CONTRIBUTING.md — Workflow conventions

   TIER 3 — Spec & Reference (read for this granule):
   - /spec/*.md — Read the spec(s) referenced by this granule. Your implementation must satisfy the spec's Acceptance Criteria.
   - /reference/*.md — Check for golden files or example implementations showing project conventions.
   - /domain/*.md — If the granule touches domain logic, verify against the relevant domain research document.

   If no spec exists for this work, create one before implementing (ADR/RFC-style — see plan prompt for format).

3. Verify that the granule is valid and that its scope represents a Minimum Viable Change.

4. If you are not able to complete the work, release the granule back to the queue and exit.

5. Implement the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Identify the minimal atomic changeset necessary to complete the work.
   c. Follow Red-Green-Refactor: write a failing test that asserts the expected behavior, make it pass with the simplest implementation, then refactor.
   d. Refactor as necessary (rename, extract, simplify — no behavioral changes).
   e. QUALITY GATE — Before committing, verify:
      - No CONSTRAINTS.md violations (search for forbidden patterns)
      - Acceptance Criteria from the spec are satisfied
      - Domain rules from /domain/*.md are respected
      - All cross-cutting concerns noted in the spec are addressed
   f. git add and commit your changes.
   g. Run the FULL test suite (not just your new tests). If tests fail, fix them before proceeding. Do NOT merge with failing tests.
   h. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - Run the full test suite AGAIN on main after merge. If tests fail, fix and re-commit before pushing.
      - git push origin main
      - git branch -d "{{branchName}}"

6. After implementation, update the spec Status from "Draft" to "Implemented" if all Acceptance Criteria are satisfied.

7. Update PROGRESS.md with the current status.

8. Create granules for any follow-up work identified during implementation.

9. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.

10. When done, mark the granule as complete with a brief summary including the list of granules you created.`;
