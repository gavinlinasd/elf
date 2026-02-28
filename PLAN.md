# OpenClaw Job Queue Skill — Architecture & Execution Plan

## Core Model: Agent-as-Executor

The queue is **not** an autonomous job processor. It's a coordination and tracking layer for OpenClaw agents. The agent is both task creator and task executor:

1. Agent decides something needs doing → `elf-do-this`
2. Agent (same or different) claims the task → `elf-on-it`
3. Agent does the work (using its own tools — shell, file I/O, APIs, etc.)
4. Agent reports the outcome → `elf-done` or `elf-borked`

The queue provides: persistence across sessions, visibility into what's pending/running/done, and coordination between multiple agents sharing a workspace. The background worker is optional — useful for automated/scheduled tasks later, but not the primary path.

## Architecture Decision: Redis + BullMQ

**Decision:** Keep Redis and BullMQ as the backing store and queue engine.

**Rationale:**
- BullMQ provides battle-tested priority queues, persistence, and concurrency control out of the box
- Redis persistence means tasks survive agent restarts and crashes
- Redis pub/sub enables real-time coordination — critical for multi-agent scenarios
- BullMQ's dashboard ecosystem (Bull Board, Arena) provides free observability for future phases
- BullMQ's built-in automatic retry and exponential backoff remain available for the optional background worker mode, but are not used in the agent-as-executor flow

**OpenClaw install gap:** There is currently no `skill:post-install` hook in OpenClaw ([Issue #23926](https://github.com/openclaw/openclaw/issues/23926)). Redis cannot be auto-started after skill installation. A separate PR will be submitted to OpenClaw to add post-install hook support. Until then, users start Redis manually. The SKILL.md `requires.env: [REDIS_URL]` gate prevents the skill from activating without a configured Redis connection.

---

## CLI Commands

The project is called **elf** — a helper that does tasks. Commands are named accordingly.

| Command | What it does | Notes |
|---|---|---|
| `elf-do-this <name> '<payload>' [--priority=1-10]` | Create a task, status becomes `queued` | Returns task ID |
| `elf-on-it <id>` | Claim a task, status becomes `running` | Prevents double-execution in multi-agent setups |
| `elf-done <id> ['<result>']` | Mark task complete with optional result JSON | Result stored on the task for later inspection |
| `elf-borked <id> '<error>'` | Mark task failed with reason | Different from cancel — "I tried and failed" |
| `elf-is-it-done <id>` | Check status of a specific task | Returns full task detail as JSON |
| `elf-whats-left [--status=X] [--limit=20]` | List tasks, filterable by status | Formatted table |
| `elf-nevermind <id>` | Cancel a task | "Don't bother" — removes from queue |

**Dropped from MVP:** `retry` command. An agent doesn't need mechanical retry. It reads the error from `elf-is-it-done`, understands why the task failed, fixes the root cause, and either re-claims the task with `elf-on-it` or creates a new one with `elf-do-this`. Retry is an intelligent decision, not a button.

---

## Current State (MVP — Needs Rework)

The following exists but uses the old `jq-*` naming and old worker-centric model:

- **SKILL.md** — manifest with `requires.env`, `requires.bins`, command reference (old names)
- **Queue engine** — `src/queue.ts` with BullMQ queue, worker, enqueue/status/list/retry/cancel
- **5 CLI commands** — `jq-enqueue`, `jq-status`, `jq-list`, `jq-retry`, `jq-cancel` (old names, missing claim/done/borked)
- **Types** — `TaskStatus` enum, `TaskData`, `TaskInfo` interfaces
- **Config** — env-based config loading (`REDIS_URL`, `MAX_RETRIES`, `CONCURRENCY`)
- **Worker** — `src/index.ts` entry point with graceful shutdown
- **Tests** — lifecycle tests covering enqueue, status, list, complete, retry, cancel
- **README** — setup instructions, usage examples, OpenClaw integration guide
- **Build** — TypeScript compilation to `dist/`, declaration files

---

## Execution Plan

### Phase 1: Agent-as-Executor Rework

Rename all commands, add the three missing operations (claim, done, borked), remove retry, and shift the model from worker-driven to agent-driven.

**Type changes (`src/types.ts`):**
- `TaskStatus` stays: `queued`, `running`, `completed`, `failed`, `cancelled`
- Add optional `result?: unknown` and `error?: string` fields to `TaskInfo` (already partially there)
- Add optional `claimedBy?: string` to `TaskInfo` — identifies which agent claimed the task
- Remove `maxRetries` from `TaskInfo` (retry is not mechanical in this model)

**Queue engine changes (`src/queue.ts`):**
- Add `claimTask(taskId, agentId?)` — moves job to `running` state, sets `claimedBy`
- Add `completeTask(taskId, result?)` — moves job to `completed`, stores result
- Add `failTask(taskId, error)` — moves job to `failed`, stores error message
- Remove `retryTask()`
- Keep `enqueueTask()`, `getTaskInfo()`, `listTasks()`, `cancelTask()` (logic stays, names stay in the engine layer)

**CLI renames and additions:**
- `src/cli/enqueue.ts` → `src/cli/do-this.ts` (rename, same logic)
- `src/cli/status.ts` → `src/cli/is-it-done.ts` (rename, same logic)
- `src/cli/list.ts` → `src/cli/whats-left.ts` (rename, same logic)
- `src/cli/cancel.ts` → `src/cli/nevermind.ts` (rename, same logic)
- `src/cli/on-it.ts` — **new**, calls `claimTask()`
- `src/cli/done.ts` — **new**, calls `completeTask()`
- `src/cli/borked.ts` — **new**, calls `failTask()`
- Delete `src/cli/retry.ts`

**package.json bin entries:**
```json
{
  "elf-do-this": "dist/cli/do-this.js",
  "elf-on-it": "dist/cli/on-it.js",
  "elf-done": "dist/cli/done.js",
  "elf-borked": "dist/cli/borked.js",
  "elf-is-it-done": "dist/cli/is-it-done.js",
  "elf-whats-left": "dist/cli/whats-left.js",
  "elf-nevermind": "dist/cli/nevermind.js"
}
```

**SKILL.md updates:**
- Rename all commands in the agent instruction body
- Update command reference table
- Add agent workflow guidance: "Create tasks with `elf-do-this`. Before starting work, claim with `elf-on-it`. When finished, report with `elf-done` or `elf-borked`. Check pending work with `elf-whats-left`."

**Test updates (`test/queue.test.ts`):**
- Replace retry test with claim → done and claim → borked tests
- Add test: claim sets status to `running` and stores `claimedBy`
- Add test: `elf-done` stores result and sets status to `completed`
- Add test: `elf-borked` stores error and sets status to `failed`
- Add test: cannot claim an already-claimed task (returns error)

### Phase 2: Connection Resilience

**Problem:** If Redis is down or unreachable, CLI commands hang or throw unhandled errors.

**Changes:**
- Add connection timeout to Redis config (default 5s) — fail fast instead of hanging
- Wrap all CLI commands with a unified connection error handler that prints: `"Error: Cannot connect to Redis at <url>. Is Redis running?"` and exits with code 1
- Add `elf-status` CLI command that checks Redis connectivity and reports queue stats (queued/running/completed/failed counts)

**Files:**
- `src/config.ts` — add `CONNECTION_TIMEOUT` env var
- `src/queue.ts` — add connection options, shared error handler
- `src/cli/status.ts` — new queue health command (distinct from `elf-is-it-done` which checks a single task)
- `package.json` — add `elf-status` bin entry
- `SKILL.md` — document `elf-status` command

### Phase 3: SKILL.md Install Spec & Docs Polish

**Problem:** The SKILL.md doesn't declare an `install` block. README needs updating for the new commands and model.

**Changes:**
- Add `install` array to SKILL.md frontmatter with `kind: node` for the npm package
- Add `install` entry with `kind: brew` for Redis (installs binary, user still starts manually)
- Rewrite README for the agent-as-executor model
- Add troubleshooting section (Redis connection issues, common errors)
- Add agent workflow examples showing full create → claim → execute → report cycle

**Files:**
- `SKILL.md` — add `install` block, finalize command reference
- `README.md` — full rewrite for new model and commands

---

## Execution Order

```
Phase 1: Agent-as-Executor Rework  ← Do first (fundamental model change + rename)
Phase 2: Connection Resilience     ← Do second (fixes broken UX when Redis is down)
Phase 3: Install Spec & Docs       ← Do last (polish for publishing)
```

Each phase is independently shippable. Tests are updated within each phase.

---

## Project Structure (After All Phases)

```
elf/
├── SKILL.md
├── PLAN.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts                # Optional background worker (kept, not primary path)
│   ├── config.ts               # Env config + connection timeout
│   ├── queue.ts                # BullMQ queue engine: enqueue, claim, complete, fail, cancel, list
│   ├── types.ts                # TaskStatus, TaskData, TaskInfo (with claimedBy, result, error)
│   └── cli/
│       ├── do-this.ts          # elf-do-this — create a task
│       ├── on-it.ts            # elf-on-it — claim a task
│       ├── done.ts             # elf-done — mark complete
│       ├── borked.ts           # elf-borked — mark failed
│       ├── is-it-done.ts       # elf-is-it-done — check single task
│       ├── whats-left.ts       # elf-whats-left — list tasks
│       ├── nevermind.ts        # elf-nevermind — cancel a task
│       └── status.ts           # elf-status — queue health + Redis connectivity
└── test/
    ├── queue.test.ts           # Full lifecycle: create → claim → done/borked
    └── connection.test.ts      # Phase 2: connection error handling
```

---

## Deferred (Post This Plan)

Out of scope:

- **Background worker mode** — automated processing with BullMQ's retry/backoff (worker exists but is optional)
- **Dashboard UI** — web-based task viewer (Bull Board integration)
- **REST API + WebSocket** — real-time task updates
- **Multi-queue support** — named queues for different task categories
- **Task retention policies** — auto-prune completed tasks after N days
- **Webhook notifications** — POST to URL on task completion/failure
- **ClawHub publishing** — publish to registry after plan is stable
- **OpenClaw post-install hook PR** — separate contribution to OpenClaw core
