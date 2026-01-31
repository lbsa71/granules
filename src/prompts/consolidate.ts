export const CONSOLIDATE_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS:
   TIER 1: CLAUDE.md, CONSTRAINTS.md, CONTRIBUTING.md
   TIER 2: ARCHITECTURE.md
   TIER 3: /spec/*.md for the work items being consolidated

3. Merge related work items. Resolve any conflicts. Ensure semantic consistency across changes — no contradicting behaviors, naming, or conventions.

4. ARTIFACT CONSISTENCY: After consolidation, verify that:
   - All affected /spec/*.md files are updated
   - ARCHITECTURE.md still reflects the codebase
   - CONSTRAINTS.md is not violated by the merged result
   - /domain/*.md docs are still accurate
   - PROGRESS.md is current

5. If you cannot complete the consolidation, release the granule back to the queue and exit.

6. Consolidate the changes:
   a. You are already on branch "{{branchName}}" in an isolated worktree.
   b. Merge the relevant work, resolving conflicts as needed.
   c. Verify semantic consistency across the consolidated changes.
   d. Check for CONSTRAINTS.md violations in the merged result.
   e. git add and commit your changes.
   f. Run the FULL test suite to verify everything passes. Do NOT proceed with failing tests.
   g. Merge to main:
      - git fetch origin main
      - git checkout main
      - git pull origin main
      - git merge "{{branchName}}" (resolve any conflicts)
      - Run the full test suite AGAIN on main after merge. If tests fail, fix and re-commit before pushing.
      - git push origin main
      - git branch -d "{{branchName}}"

7. Update PROGRESS.md with consolidation results.

8. Create granules for any follow-up work identified during consolidation.

9. BEFORE marking complete: Verify you have created granules for ALL identified gaps or issues. Listing problems without creating granules is a failure mode.

10. When done, mark the granule as complete with a summary of what was consolidated and the list of granules you created.`;
