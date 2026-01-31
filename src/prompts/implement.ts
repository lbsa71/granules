export const IMPLEMENT_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the codebase as needed.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. READ THE SPEC: Check /spec/*.md for the relevant spec(s) referenced by this granule. Your implementation must satisfy the spec's Acceptance Criteria. If no spec exists for this work, create one before implementing (ADR/RFC-style — see plan prompt for format).
5. Verify that the granule is valid and that its scope represents a Minimum Viable Change.
6. If you are not able to complete the work, release the granule back to the queue and exit.
7. Implement the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Identify the minimal atomic changeset necessary to complete the work.
   c. Follow Red-Green-Refactor: write a failing test that asserts the expected behavior, make it pass with the simplest implementation, then refactor.
   d. Refactor as necessary (rename, extract, simplify — no behavioral changes).
   e. git add and commit your changes.
   f. Run the FULL test suite (not just your new tests). If tests fail, fix them before proceeding. Do NOT merge with failing tests.
   g. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - Run the full test suite AGAIN on main after merge. If tests fail, fix and re-commit before pushing.
      - git push origin main
      - git branch -d "{{branchName}}"
8. After implementation, update the spec Status from "Draft" to "Implemented" if all Acceptance Criteria are satisfied.
9. Create granules for any follow-up work identified during implementation.
10. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.
11. When done, mark the granule as complete with a brief summary including the list of granules you created.`;
