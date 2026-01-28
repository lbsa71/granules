export const IMPLEMENT_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the codebase as needed.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Verify that the granule is valid and whether you agree that the content is a valid task to be implemented.
5. If you are not able to complete the work, release the granule back to the queue and exit.
6. Implement the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Identify the smallest set of changes that are necessary to complete the work.
   c. Make the changes in a TDD manner; test for the negative, then implement the positive.
   d. Refactor and restructure as necessary.
   e. git add and commit your changes.
   f. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any follow-up work identified during implementation.
8. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a brief summary including the list of granules you created.`;
