export const PLAN_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the relevant parts of the codebase.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create a granule to update it:
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
4. Design a clear implementation approach. Break the work into discrete, testable steps.
5. If you cannot create a viable plan, release the granule back to the queue and exit.
6. Create granules for each implementation step identified in your plan. Each granule should be small and focused.
7. BEFORE marking complete: Verify you have created granules for ALL planned implementation steps. A plan without actionable granules is a failure mode.
8. When done, mark the granule as complete with a summary of your plan and the list of granules you created.`;
