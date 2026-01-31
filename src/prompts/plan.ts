export const PLAN_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the relevant parts of the codebase.

3. MANDATORY ARTIFACT TREE: Ensure the following project artifacts exist. If missing, incomplete, or out of date, create or update them (or create granules to do so):

   TIER 1 — Constraints & Standards (read for ALL work):
   - CLAUDE.md — AI assistant guide with tiered document loading, work modes, quality gates, and forbidden patterns
   - CONSTRAINTS.md — Hard rules, invariants, forbidden patterns (grep-able). These are non-negotiable across all work.
   - CONTRIBUTING.md — Development workflow, branching, commit conventions

   TIER 2 — Architecture & Domain (read for planning & design):
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md — System structure, component relationships, data flow
   - /domain/*.md — Domain research, business rules, edge cases, regulatory constraints. Workers verify implementation against these. Do not let workers "wing" domain knowledge — capture it here first.

   TIER 3 — Specs & Progress (read for implementation):
   - /spec/*.md — RFC-style specs (see step 4)
   - PROGRESS.md — Status matrix: which specs are Draft/Accepted/Implemented, component status, version history
   - /reference/*.md — Golden files, example implementations showing "what good looks like" in this project's conventions

4. MANDATORY SPEC PHASE: Before designing implementation steps, create or update spec files in /spec/*.md for each component or feature being planned.

   TWO GUIDING PRINCIPLES:
   - **Minimum Viable Change (MVC):** Each spec describes the smallest unit of work that delivers standalone value. If a spec can be decomposed into two independently valuable specs, decompose it. A spec with implicit dependencies on unwritten specs is too coarse-grained.
   - **Test-Driven Design (TDD at the spec level):** Define Acceptance Criteria FIRST. Before specifying the solution, define the verifiable conditions that prove the spec is correctly implemented. The design section then describes HOW to satisfy those criteria. This is Red-Green-Refactor applied to planning: Red (define what must pass) → Green (design to make it pass).

   Spec format (ADR/RFC-style — see https://adr.github.io and IETF RFC format):
   - Title, Status (Draft | Accepted | Implemented | Deprecated), Author, Date
   - Summary (1-2 sentences)
   - Motivation / problem statement
   - Acceptance Criteria (FIRST — specific, testable conditions for "done")
   - Detailed Design (interfaces, data flow, error handling, invariants — i.e., how to satisfy the acceptance criteria)
   - Cross-Cutting Concerns (which items from CONSTRAINTS.md apply, which /domain/*.md to verify against)
   - Unresolved Questions (if any)

   Each spec should be a self-contained document that a worker can implement from without ambiguity.

5. CROSS-CUTTING CONCERN TRACKER: If the project has cross-cutting concerns (logging, auth, error handling, caching, validation, etc.), ensure they are tracked in ARCHITECTURE.md or a dedicated CONCERNS.md — a traceability matrix showing which components implement them and their status. Specs should reference which concerns apply.

6. CONSISTENCY CHECK: Ensure all artifacts tell the same story. README, ARCHITECTURE, CONSTRAINTS, domain docs, specs, and CLAUDE.md must not contradict each other. If they do, fix them before proceeding.

7. Design a clear implementation approach. Break the work into discrete, testable steps — each traceable to a spec.

8. If you cannot create a viable plan, release the granule back to the queue and exit.

9. Create granules for each implementation step. Each granule should:
   - Reference which spec(s) it implements
   - Represent a Minimum Viable Change that moves a spec toward "Implemented"
   - Note which CONSTRAINTS.md rules and /domain/*.md docs the worker must verify against

10. BEFORE marking complete: Verify you have created granules for ALL planned implementation steps. A plan without actionable granules is a failure mode.

11. Update PROGRESS.md with the current status of all specs and planned work.

12. When done, mark the granule as complete with a summary of your plan and the list of granules you created.`;
