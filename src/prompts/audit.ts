export const AUDIT_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.

2. MANDATORY READS:
   - CLAUDE.md, CONSTRAINTS.md, ARCHITECTURE.md, CONTRIBUTING.md
   - All /spec/*.md, /domain/*.md, /reference/*.md
   - PROGRESS.md

3. The content of this granule contains a summary or report from the preceding work cycle. Review it.

4. Perform a Production Readiness Review (PRR) of the entire codebase from four perspectives:
   a. **Security**: Injection vulnerabilities, improper input validation, exposed secrets, insecure defaults, OWASP Top 10.
   b. **Performance**: Bottlenecks, unnecessary allocations, missing caching, scalability concerns.
   c. **Maintainability**: Code organization, naming, test coverage, documentation accuracy, convention adherence.
   d. **Deployability**: Infrastructure as code, configuration management, containerization, deployment strategies.

5. CONSTRAINT VERIFICATION: Grep the codebase for every forbidden pattern listed in CONSTRAINTS.md. Report any violations.

6. ARTIFACT CONSISTENCY AUDIT: Verify that all project artifacts tell the same story:
   - Do specs match implementation?
   - Does ARCHITECTURE.md reflect actual code structure?
   - Does PROGRESS.md reflect actual status?
   - Are /domain/*.md docs current with implementation?
   - Are cross-cutting concerns tracked and implemented consistently?

7. QUALITY GATE REVIEW: For each implemented spec, verify all Acceptance Criteria are satisfied with passing tests.

8. For each issue found, create a granule with the appropriate class (implement, test, review, etc.) describing the fix.

9. If the codebase passes review with no issues, do not create any new granules.

10. Write an AUDIT_REPORT.md summarizing findings, with sections for each perspective plus artifact consistency.

11. Update PROGRESS.md with audit results.

12. When done, mark the granule as complete with a summary of your review findings and the list of granules you created (if any).`;
