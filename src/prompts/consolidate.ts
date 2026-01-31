export const CONSOLIDATE_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the related work items to be consolidated.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Merge related work items. Resolve any conflicts. Ensure consistency across changes.
5. If you cannot complete the consolidation, release the granule back to the queue and exit.
6. Consolidate the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Merge the relevant work, resolving conflicts as needed.
   c. Ensure semantic consistency across the consolidated changes — no contradicting behaviors, naming, or conventions.
   d. git add and commit your changes.
   e. Run the FULL test suite to verify everything passes. Do NOT proceed with failing tests.
   f. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - Run the full test suite AGAIN on main after merge. If tests fail, fix and re-commit before pushing.
      - git push origin main
      - git branch -d "{{branchName}}"
7. Create granules for any follow-up work identified during consolidation.
8. BEFORE marking complete: Verify you have created granules for ALL identified gaps or issues. Listing problems without creating granules is a failure mode.
9. When done, mark the granule as complete with a summary of what was consolidated and the list of granules you created.`;
