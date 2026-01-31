export const PLAN_PROMPT = `Instructions:
1. FIRST ACTION: Claim this granule using your worker ID ({{workerId}}) and granule ID ({{granuleId}}). Do this before any other action.
2. After claiming, familiarize yourself with the project and the relevant parts of the codebase.
3. MANDATORY DOCUMENTATION CHECK: Read each of the following files. If missing, incomplete or out of date, create or update it (or create a granule to do so):
   - README.md (root and each subsystem folder)
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CLAUDE.md
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
   - Unresolved Questions (if any)

   Each spec should be a self-contained document that a worker can implement from without ambiguity.

5. CONSISTENCY CHECK: Ensure all documentation (README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md) and all spec files tell the same story. If they contradict each other, fix them before proceeding.
6. Design a clear implementation approach. Break the work into discrete, testable steps — each traceable to a spec.
7. If you cannot create a viable plan, release the granule back to the queue and exit.
8. Create granules for each implementation step. Each granule should reference which spec(s) it implements and should represent a Minimum Viable Change that moves a spec toward "Implemented."
9. BEFORE marking complete: Verify you have created granules for ALL planned implementation steps. A plan without actionable granules is a failure mode.
10. When done, mark the granule as complete with a summary of your plan and the list of granules you created.`;
