# GRANULES Architectural Audit Report

**Date**: 2026-01-31
**Auditor**: Worker W-2
**Granule**: G-2 (audit class)
**Version**: 1.0.17

## Executive Summary

GRANULES is a well-structured minimal multi-agent orchestrator. The codebase is clean, well-tested (90 tests across 7 test files), and appropriately documented. This audit supersedes the previous report (2026-01-28) which was based on an earlier version with 48 tests.

**Overall Assessment**: Production-ready for its intended use case as a local development orchestration tool.

---

## Security

| ID | Finding | Severity | Location | Notes |
|----|---------|----------|----------|-------|
| SEC-1 | Shell command interpolation in `execSync` | Low | `worker.ts:56-57`, `orchestrator.ts:131` | Branch names are internally generated (`worker-W-N-granule-G-N`) so injection risk is minimal. The `esc()` function in `worker.ts:85` escapes single quotes in the prompt. |
| SEC-2 | `--dangerously-skip-permissions` flag | Info | `worker.ts:90` | By design — workers need autonomous file/git access. |
| SEC-3 | Unauthenticated MCP HTTP server | Low | `server.ts:129` | Binds to localhost. Any local process can manipulate granules. Acceptable for a local dev tool. |
| SEC-4 | No input size limits on granule content | Low | `store.ts:12` | A malicious MCP client could submit very large content strings. Low risk given local-only access. |
| SEC-5 | Temp script written to `/tmp` with prompt content | Low | `worker.ts:86-92` | Script has 0o700 permissions and is cleaned up on exit. Brief window where prompt is on disk. |

**No high or critical security issues found.**

---

## Performance

| ID | Observation | Assessment |
|----|-------------|------------|
| PERF-1 | In-memory store with `Map` | O(1) lookups. Appropriate for expected granule counts (<100). |
| PERF-2 | `listGranules()` creates new array each call | Called every 5s in tick loop. Negligible at expected scale. |
| PERF-3 | 5-second polling loop | Adequate. No need for event-driven at this scale. |
| PERF-4 | 200ms UI render interval (screen clear + full redraw) | May cause flicker on slow terminals. Acceptable trade-off. |
| PERF-5 | `FileStore.persist()` writes full state on every mutation | Atomic write via rename is correct. Frequency is low enough. |

**No performance issues requiring action.**

---

## Maintainability

### Strengths
- **90 tests** across 7 files with good coverage of core operations
- Clean separation: store, server, orchestrator, worker, UI, session-log, file-store
- TypeScript strict mode
- Prompts extracted to individual files under `src/prompts/`
- `Store` interface allows swappable implementations (memory vs file)
- `MAX_RETRIES` extracted to `constants.ts`

### Issues Found

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| MAINT-1 | `express` is a production dependency but never imported | Low | `package.json:32` |
| MAINT-2 | `@types/express` is a dev dependency but express is unused | Low | `package.json:36` |
| MAINT-3 | `src/tools/` directory with `getTools()` function appears to be dead code — `server.ts` registers tools inline using `server.tool()` | Low | `src/tools/index.ts` |
| MAINT-4 | `supertest` dev dependency appears unused (no imports found) | Low | `package.json:38` |

---

## Deployability

| ID | Observation | Assessment |
|----|-------------|------------|
| DEPLOY-1 | CI workflow exists (`.github/workflows/ci.yml`) | Good |
| DEPLOY-2 | Auto-publish workflow exists (`.github/workflows/publish.yml`) | Good |
| DEPLOY-3 | Port configurable via `PORT` env var | Good |
| DEPLOY-4 | Graceful shutdown handles SIGTERM/SIGINT | Good |
| DEPLOY-5 | `package.json` correctly configured with `bin`, `files`, `type: "module"` | Good |
| DEPLOY-6 | No Dockerfile | Low priority — appropriate for an npm CLI tool |

---

## Artifact Consistency

| Artifact | Status | Notes |
|----------|--------|-------|
| ARCHITECTURE.md | Mostly accurate | Missing: `file-store.ts`, `constants.ts`, `src/prompts/` directory. Lists `docs/granule-flow.md` correctly. Test count says "5 test files" but there are 7. |
| README.md | Accurate | Correct overview, structure, and links. |
| CONTRIBUTING.md | Accurate | Correctly describes TDD workflow and worktree process. |
| docs/ | 4 files present as documented | `configuration.md`, `granule-flow.md`, `mcp-tools.md`, `worker-prompts.md` |
| No CONSTRAINTS.md | N/A | Not needed for a complete project. |
| No PROGRESS.md | N/A | Not needed for a complete project. |
| No spec/ or domain/ dirs | N/A | Appropriate for project scope. |

---

## Recommendations

### Should Fix (Low Effort)
1. **Remove unused `express` and `@types/express` dependencies** from `package.json` — reduces install size
2. **Remove unused `supertest` dev dependency** if confirmed unused
3. **Update ARCHITECTURE.md** to mention `file-store.ts`, `constants.ts`, `src/prompts/`, and correct test file count

### Consider for Future
1. Remove or integrate `src/tools/` dead code (currently tools are registered inline in `server.ts`)
2. Add rate limiting or content size limits on MCP endpoints for defense-in-depth

---

## Conclusion

The codebase passes this audit. It is well-tested, cleanly organized, and appropriately documented. The issues found are minor housekeeping items (unused dependencies, slightly stale ARCHITECTURE.md). No blocking issues or new granules required.

**No critical, high, or medium severity issues found.**
