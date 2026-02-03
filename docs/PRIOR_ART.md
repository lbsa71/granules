# Prior Art: Multi-Agent Coordination Patterns

## KeepALifeUS/autonomous-agents

**URL:** https://github.com/KeepALifeUS/autonomous-agents

Production multi-agent system using stigmergy (indirect coordination through shared environment).

### Architecture
- 4 specialized agents: THINKER (architect), BUILDER-UI, BUILDER-DDD, GUARDIAN (reviewer)
- Coordination via Git repo as shared environment
- No direct agent-to-agent messaging

### Key Patterns

**Task Claiming via Git Mutex:**
```
1. Agent reads tasks/queue.json
2. Finds unclaimed task matching skills
3. Moves to tasks/active.json with agent ID
4. Commits and pushes immediately
5. Git conflict = another agent claimed = retry
```

**Self-Healing:**
- 4-hour timeout → auto-release task
- 2-hour stale lock expiry
- 3+ rejections → decompose or escalate
- Auto-rebase with exponential backoff

**Self-Improvement:**
- Records patterns (reusable solutions) and lessons (mistakes)
- 24-hour improvement cycle: collect rejections → draft prompt improvements → evaluate

### Results
- 80% token reduction (incremental context loading)
- Zero conflicts (Git-based mutex)
- Autonomous extended operation

### Comparison to Granules

| Aspect | autonomous-agents | Granules |
|--------|------------------|----------|
| Coordination | Git commits | FileStore + SHA-256 |
| Task format | JSON files | .granules.json |
| Agent roles | Fixed 4 roles | Configurable workers |
| Self-improvement | patterns.jsonl | Not yet implemented |
| Token optimization | Incremental context | In progress |

### Ideas to Adopt

1. **Timeout-based task release** — auto-release after N hours
2. **Pattern/lesson recording** — track what works/fails
3. **Incremental context loading** — don't load full context every time

---

*Document maintained by Rook. Last updated: 2026-02-03*
