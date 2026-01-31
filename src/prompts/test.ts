export const TEST_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS:
   TIER 1: CLAUDE.md, CONSTRAINTS.md, CONTRIBUTING.md
   TIER 3: /spec/*.md for Acceptance Criteria, /reference/*.md for test conventions, /domain/*.md for domain rules

3. Verify that the granule is valid and the testing scope is clear. Tests should verify spec Acceptance Criteria and domain invariants.

4. If you are not able to complete the work, release the granule back to the queue and exit.

5. Write and run tests:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Write tests following Arrange-Act-Assert (AAA) structure. Each test should be isolated, deterministic, and test behavior (not implementation details).
   c. Cover: happy paths, edge cases, error paths, boundary conditions, and domain invariants from /domain/*.md.
   d. Verify no CONSTRAINTS.md violations in test code itself.
   e. Run the FULL test suite (not just your new tests) to verify everything passes. Do NOT proceed with failing tests.
   f. git add and commit your changes.
   g. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - Run the full test suite AGAIN on main after merge. If tests fail, fix and re-commit before pushing.
      - git push origin main
      - git branch -d "{{branchName}}"

6. Update PROGRESS.md with test coverage status.

7. Create granules for any bugs found or additional test coverage needed.

8. BEFORE marking complete: Verify you have created granules for ALL identified issues or gaps. Listing problems without creating granules is a failure mode.

9. When done, mark the granule as complete with a summary of test results and the list of granules you created.`;
