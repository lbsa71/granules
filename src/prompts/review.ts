export const REVIEW_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the code or work to be reviewed.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Review the work thoroughly. Check for correctness, convention adherence, edge cases, error handling, and semantic consistency with existing code and /spec/*.md Acceptance Criteria.
5. If you cannot complete the review, release the granule back to the queue and exit.
6. Provide constructive feedback. Create granules for any issues that need to be addressed.
7. BEFORE marking complete: Verify you have created granules for ALL identified issues. Listing problems without creating granules is a failure mode.
8. When done, mark the granule as complete with a summary of your review findings and the list of granules you created.`;
