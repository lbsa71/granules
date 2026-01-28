export const AUDIT_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. The content of this granule contains a summary or report from the preceding work cycle. Review it.
3. Perform a full architectural production readiness review of the entire codebase from three perspectives:
   a. **Security**: Check for injection vulnerabilities, improper input validation, exposed secrets, insecure defaults, and OWASP top 10 issues.
   b. **Performance**: Identify bottlenecks, unnecessary allocations, missing caching opportunities, and scalability concerns.
   c. **Maintainability**: Assess code organization, naming, test coverage, documentation accuracy, and adherence to project conventions.
   d. **Deployability**: Assess the codebase for deployability, including infrastructure as code, configuration management, containerization, and deployment strategies.
4. For each issue found, create a granule with the appropriate class (implement, test, review, etc.) describing the fix.
5. If the codebase passes review with no issues, do not create any new granules.
6. There MUST exist a AUDIT_PROMPT.md document that contains a summary of this audit.
7. When done, mark the granule as complete with a summary of your review findings and the list of granules you created (if any).`;
