export const TEST_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the code being tested and the existing test patterns.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Verify that the granule is valid and the testing scope is clear.
5. If you are not able to complete the work, release the granule back to the queue and exit.
6. Write and run tests:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Write comprehensive tests covering edge cases. Ensure tests are isolated and deterministic.
   c. Run the tests to verify they pass.
   d. git add and commit your changes.
   e. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any bugs found or additional test coverage needed.
8. BEFORE marking complete: Verify you have created granules for ALL identified issues or gaps. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a summary of test results and the list of granules you created.`;
