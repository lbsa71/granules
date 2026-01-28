# Granule Flow

This document describes the typical flow of granules through a session, from bootstrap to completion.

## State Diagram

```
                              ┌─────────────────────────────────────────────┐
                              │              ORCHESTRATOR START             │
                              └─────────────────────┬───────────────────────┘
                                                    │
                              ┌─────────────────────▼───────────────────────┐
                              │            No granules exist?               │
                              └─────────────────────┬───────────────────────┘
                                                    │
                         ┌──────────────────────────┴──────────────────────────┐
                         │                                                     │
                    no -p flag                                            -p "task"
                         │                                                     │
                         ▼                                                     ▼
              ┌─────────────────────┐                               ┌─────────────────────┐
              │    plan granule     │                               │  implement granule  │
              │  "gap analysis..."  │                               │   user's prompt     │
              └──────────┬──────────┘                               └──────────┬──────────┘
                         │                                                     │
                         ▼                                                     │
              ┌─────────────────────┐                                          │
              │   Worker claims &   │◄─────────────────────────────────────────┘
              │   processes granule │
              └──────────┬──────────┘
                         │
       ┌─────────────────┼─────────────────┬─────────────────┬─────────────────┐
       │                 │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   explore   │  │    plan     │  │  implement  │  │    test     │  │   review    │
│             │  │             │  │             │  │             │  │             │
│ Understand  │  │ Design      │  │ Write code  │  │ Write tests │  │ Critique    │
│ codebase    │  │ approach    │  │ TDD + merge │  │ Find bugs   │  │ Find issues │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │                │
       │    creates     │    creates     │    creates     │    creates     │
       │                │                │                │                │
       ▼                ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            NEW GRANULES (any class)                             │
│                                                                                 │
│  explore → plan, implement (areas needing work)                                 │
│  plan    → implement (each step of the plan)                                    │
│  implement → test, review, implement, audit (follow-up work)              │
│  test    → implement (bugs found)                                               │
│  review  → implement (issues found)                                             │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  │ when all other work is complete
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 audit                                     │
│                                                                                 │
│  Deferred: only queued when NO other unclaimed granules remain and              │
│  no workers are active.                                                         │
│                                                                                 │
│  The worker performs a full architectural review:                                │
│    • Security (injection, validation, secrets, OWASP top 10)                    │
│    • Performance (bottlenecks, allocations, caching, scalability)               │
│    • Maintainability (organization, naming, tests, docs, conventions)           │
│                                                                                 │
│  Its content is displayed in the UI status panel.                               │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │ Issues found?                                                       │        │
│  │   YES → creates new granules → loop continues                       │        │
│  │   NO  → system idles, REPL remains active                           │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REPL remains active                                │
│                     User can add more tasks or type 'exit'                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## audit Granule: Deferred Scheduling

The `audit` granule has special scheduling behavior:

1. **Deferred**: It is NOT queued for a worker while other unclaimed granules exist or workers are active.
2. **Architectural review**: When finally scheduled, the worker performs a full review (security, performance, maintainability).
3. **May spawn work**: If the review finds issues, new granules are created and the cycle continues.
4. **UI status**: The audit granule's content is displayed as the status report in the UI.
5. **No auto-exit**: The system never exits on its own. After the audit granule completes, the REPL remains active waiting for user input.

## Typical Session Examples

### Example 1: Default Bootstrap (Gap Analysis)

```
npm start
    │
    ▼
[plan] "Read README.md and perform gap analysis..."
    │
    ├──► [implement] "Add missing tests for store.ts"
    ├──► [implement] "Update ARCHITECTURE.md with new component"
    └──► [audit] "Project complete. All gaps addressed."
                │
                │ (deferred until implements finish)
                ▼
        [audit worker runs architectural review]
                │
                ├──► [implement] "Fix: sanitize MCP tool inputs"  ← (if issues found)
                └──► (no issues → system idles)
```

### Example 2: Custom Task (-p flag)

```
npm start -- -p "Add a /health endpoint"
    │
    ▼
[implement] "Add a /health endpoint"
    │
    ├──► [test] "Add tests for /health endpoint"
    ├──► [implement] "Update API documentation"
    └──► [audit] "Health endpoint added with tests and docs."
                │
                │ (deferred until other work finishes)
                ▼
        [audit worker runs architectural review]
                │
                └──► (no issues → system idles, REPL active)
```

### Example 3: Review Finds Issues

```
[audit] "Feature X complete."
    │
    ▼ (architectural review)
    │
    ├──► [implement] "Fix: SQL injection in query builder"
    ├──► [test] "Add security tests for input validation"
    └──► [implement] "Add rate limiting to API endpoints"
             │
             │ (new work runs, eventually another audit is created)
             ▼
        [audit] "Security fixes applied."
             │
             ▼ (another architectural review)
             └──► (clean → system idles)
```

## Class Spawning Patterns

| From Class   | Typically Spawns                          |
|--------------|-------------------------------------------|
| explore      | plan, implement                           |
| plan         | implement (multiple, one per step)        |
| implement    | test, review, implement, audit      |
| test         | implement (for bugs)                      |
| review       | implement (for issues)                    |
| consolidate  | implement, audit                    |
| audit  | implement, test, review (from arch review)|
