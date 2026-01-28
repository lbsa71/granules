# Worker Prompt System

Workers receive class-specific instruction templates based on the granule type they're processing.

## Prompt Structure

Each worker prompt consists of:
1. **Header**: Worker identification
2. **Task details**: Granule ID, class, and content
3. **Class-specific instructions**: Full workflow tailored to the granule class
4. **Footer**: Available MCP tools

## Class-Specific Instructions

The `CLASS_PROMPTS` dictionary in `src/worker.ts` defines instruction templates for each granule class. Templates use placeholders (`{{workerId}}`, `{{granuleId}}`, `{{branchName}}`) that are substituted at runtime.

### explore
Focus on understanding codebase structure, patterns, and dependencies. Document findings and create granules for areas needing deeper investigation.

### plan
Design implementation approach. Break work into discrete, testable steps. Create granules for each implementation step.

### implement
Full TDD workflow: write tests, implement code, refactor. Operates in isolated git worktree. Merges to main when complete.

### test
Write comprehensive tests covering edge cases. Run tests to verify they pass. Create granules for bugs found.

### review
Critique work thoroughly. Check for bugs, style issues, missed edge cases. Create granules for issues that need addressing.

### consolidate
Merge related work items. Resolve conflicts. Ensure consistency across changes.

### audit
Deferred until no other work remains. Performs a full architectural review of the codebase from three perspectives: security (injection, validation, secrets, OWASP top 10), performance (bottlenecks, caching, scalability), and maintainability (organization, naming, tests, docs). Creates granules for any issues found. If the codebase passes review, no granules are created and the system idles.

## Common Elements

All actionable classes share these steps:
1. Claim the granule first
2. Check documentation files (README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md)
3. Create granules for follow-up work
4. Mark complete with summary
