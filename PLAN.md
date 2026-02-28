# OpenClaw Job Queue Skill — Architecture & Execution Plan

## Architecture Decision: Redis + BullMQ

**Decision:** Keep Redis and BullMQ as the backing store and queue engine.

**Rationale:**
- BullMQ provides battle-tested job scheduling, retries with exponential backoff, priority queues, concurrency control, and stall detection out of the box
- Redis persistence means jobs survive agent restarts and crashes
- Redis pub/sub enables real-time worker coordination — critical for multi-agent scenarios
- BullMQ's dashboard ecosystem (Bull Board, Arena) provides free observability for future phases
- SQLite would require reimplementing all of this from scratch for marginal install convenience

**OpenClaw install gap:** There is currently no `skill:post-install` hook in OpenClaw ([Issue #23926](https://github.com/openclaw/openclaw/issues/23926)). This means Redis cannot be auto-started after skill installation. A separate PR will be submitted to OpenClaw to add post-install hook support. Until then, users must start Redis manually before using the skill. The SKILL.md `requires.env: [REDIS_URL]` gate prevents the skill from activating without a configured Redis connection.

---

## Current State (MVP — Complete)

The following is already implemented and working:

- **SKILL.md** — manifest with `requires.env`, `requires.bins`, command reference
- **Queue engine** — `src/queue.ts` with BullMQ queue, worker, enqueue/status/list/retry/cancel
- **5 CLI commands** — `jq-enqueue`, `jq-status`, `jq-list`, `jq-retry`, `jq-cancel`
- **Types** — `TaskStatus` enum, `TaskData`, `TaskInfo` interfaces
- **Config** — env-based config loading (`REDIS_URL`, `MAX_RETRIES`, `CONCURRENCY`)
- **Worker** — `src/index.ts` entry point with graceful shutdown
- **Tests** — lifecycle tests covering enqueue, status, list, complete, retry, cancel
- **README** — setup instructions, usage examples, OpenClaw integration guide
- **Build** — TypeScript compilation to `dist/`, declaration files

---

## What's Next: Hardening & Production Readiness

### Phase 1: Connection Resilience

**Problem:** If Redis is down or unreachable, CLI commands hang or throw unhandled errors. The worker crashes without recovery.

**Changes:**
- Add connection timeout to Redis config (default 5s) — fail fast instead of hanging
- Add retry strategy for transient Redis disconnects in the worker (exponential backoff, max 10 retries)
- Wrap all CLI commands with a unified connection error handler that prints a clear message: `"Error: Cannot connect to Redis at <url>. Is Redis running?"` and exits with code 1
- Add a `jq-health` CLI command that checks Redis connectivity and reports queue stats (pending/active/completed/failed counts)

**Files:**
- `src/config.ts` — add `CONNECTION_TIMEOUT` env var
- `src/queue.ts` — add connection options, retry strategy, shared error handler
- `src/cli/health.ts` — new health check command
- `package.json` — add `jq-health` bin entry
- `SKILL.md` — document `jq-health` command

### Phase 2: Worker Process Management

**Problem:** The worker (`npm start`) must run as a separate long-lived process. There's no way to manage it from the CLI — the agent can't check if it's running, start it, or stop it.

**Changes:**
- Add `jq-worker start` command — starts the worker as a background daemon, writes PID to `~/.openclaw/skills/job-queue/worker.pid`
- Add `jq-worker stop` command — reads PID file, sends SIGTERM, cleans up PID file
- Add `jq-worker status` command — checks if PID is alive, reports worker state
- Worker writes logs to `~/.openclaw/skills/job-queue/worker.log` (rotated, last 1000 lines)
- Update SKILL.md agent instructions: "Before enqueuing tasks, check `jq-worker status`. If not running, start it with `jq-worker start`."

**Files:**
- `src/cli/worker.ts` — new worker management command (start/stop/status subcommands)
- `src/index.ts` — add PID file writing, log file output
- `package.json` — add `jq-worker` bin entry
- `SKILL.md` — update command reference

### Phase 3: Task Output Capture

**Problem:** The default worker processor just returns the payload. Real tasks need to capture stdout/stderr from shell commands the agent enqueues.

**Changes:**
- Add a `command` task type that executes a shell command and captures stdout/stderr
- Task result includes `{ exitCode, stdout, stderr, durationMs }`
- Add configurable timeout per task (default 5 minutes, max 30 minutes)
- Stdout/stderr truncated to 100KB to prevent memory issues
- Worker processor routes by task type: `command` runs shell, `custom` returns payload as-is

**Files:**
- `src/types.ts` — add `TaskType` enum (`command`, `custom`), extend `TaskData` with `command` field, extend `TaskInfo` with `stdout`/`stderr`/`exitCode`/`durationMs`
- `src/queue.ts` — update processor to handle `command` type with `child_process.spawn`
- `src/cli/enqueue.ts` — accept `--type=command` flag, validate command string
- `SKILL.md` — document command task type

### Phase 4: SKILL.md Install Spec & Docs Polish

**Problem:** The SKILL.md doesn't declare an `install` block, so OpenClaw can't auto-install BullMQ's npm dependencies. README needs updating for the new commands.

**Changes:**
- Add `install` array to SKILL.md frontmatter with `kind: node` for the npm package
- Add `install` entry with `kind: brew` for Redis (installs binary, user still starts manually)
- Update README with new commands (`jq-health`, `jq-worker`)
- Add troubleshooting section to README (Redis connection issues, worker not running)
- Update PLAN.md to mark phases complete as they ship

**Files:**
- `SKILL.md` — add `install` block to frontmatter, update command reference
- `README.md` — new commands, troubleshooting section

---

## Execution Order

```
Phase 1: Connection Resilience     ← Do first (fixes broken UX when Redis is down)
Phase 2: Worker Process Management ← Do second (agent can self-manage the worker)
Phase 3: Task Output Capture       ← Do third (enables real work, not just echo)
Phase 4: Install Spec & Docs       ← Do last (polish for publishing)
```

Each phase is independently shippable. Tests are updated within each phase.

---

## Project Structure (After All Phases)

```
openclaw-job-queue/
├── SKILL.md
├── PLAN.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts                # Worker entry point (Phase 2: daemonizable)
│   ├── config.ts               # Env config + connection timeout
│   ├── queue.ts                # BullMQ queue, worker, error handling
│   ├── types.ts                # TaskStatus, TaskType, TaskData, TaskInfo
│   └── cli/
│       ├── enqueue.ts          # jq-enqueue (Phase 3: --type=command)
│       ├── status.ts           # jq-status
│       ├── list.ts             # jq-list
│       ├── retry.ts            # jq-retry
│       ├── cancel.ts           # jq-cancel
│       ├── health.ts           # jq-health (Phase 1: new)
│       └── worker.ts           # jq-worker start|stop|status (Phase 2: new)
└── test/
    ├── queue.test.ts           # Existing lifecycle tests
    ├── health.test.ts          # Phase 1: connection error tests
    ├── worker.test.ts          # Phase 2: daemon management tests
    └── command.test.ts         # Phase 3: command execution tests
```

---

## Deferred (Post-Hardening)

Out of scope for this plan:

- **Dashboard UI** — web-based task viewer (Bull Board integration)
- **REST API + WebSocket** — real-time task updates
- **Multi-queue support** — named queues for different task categories
- **Task retention policies** — auto-prune completed tasks after N days
- **Webhook notifications** — POST to URL on task completion/failure
- **ClawHub publishing** — publish to registry after hardening is stable
- **OpenClaw post-install hook PR** — separate contribution to OpenClaw core
