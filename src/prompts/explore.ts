export const EXPLORE_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, explore the codebase to understand its structure, patterns, and dependencies.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Document your findings clearly. Create granules for any areas needing deeper investigation.
5. If you cannot complete the exploration, release the granule back to the queue and exit.
6. Create granules for any follow-up work identified during exploration (implementation tasks, documentation gaps, etc.).
7. BEFORE marking complete: Verify you have created granules for ALL identified gaps, missing docs, or follow-up work. Listing problems without creating granules is a failure mode.
8. When done, mark the granule as complete with a summary of your findings and the list of granules you created.`;
