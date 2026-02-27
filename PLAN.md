# OpenClaw Job Queue Skill — Execution Plan

## Context

Build an OpenClaw skill that gives the agent a local job queue for tracking async tasks. The skill teaches OpenClaw to use CLI commands (via its `shell` tool) backed by Bull MQ + Redis.

## Project Structure

```
openclaw-job-queue/
├── SKILL.md                    # Skill manifest + agent instructions
├── package.json                # bin entries for CLI commands
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                # Starts queue worker
│   ├── config.ts               # Env-based config (REDIS_URL, etc.)
│   ├── queue.ts                # Bull MQ queue + worker setup
│   ├── types.ts                # Task data model + status enum
│   └── cli/
│       ├── enqueue.ts          # jq-enqueue <name> <payload>
│       ├── status.ts           # jq-status <task-id>
│       ├── list.ts             # jq-list [--status=failed]
│       ├── retry.ts            # jq-retry <task-id>
│       └── cancel.ts           # jq-cancel <task-id>
└── test/
    └── queue.test.ts           # Core lifecycle tests
```

~10 files total.

## Execution Steps

### Step 1: Scaffold + SKILL.md

Create the project root with:
- `package.json` — dependencies (bullmq, ioredis) + `bin` entries mapping `jq-*` commands to `src/cli/*.ts`
- `tsconfig.json` — standard Node/TS config
- `.env.example` — `REDIS_URL=redis://localhost:6379`
- `SKILL.md` — YAML frontmatter (`name: job-queue`, `requires.env: [REDIS_URL]`, `requires.bins: [node, npx]`, `primaryEnv: REDIS_URL`) + markdown body with command reference the agent reads at runtime

### Step 2: Queue Engine + Types

- `src/types.ts` — `Task` interface, `TaskStatus` enum (queued/running/completed/failed/cancelled)
- `src/config.ts` — load `REDIS_URL`, `MAX_RETRIES`, `CONCURRENCY` from env
- `src/queue.ts` — Bull MQ queue definition, worker with processor, event handlers for progress/completion/failure

### Step 3: CLI Commands

Five standalone scripts, each registered as a `bin` in package.json:

| Command | Action | Output |
|---------|--------|--------|
| `jq-enqueue <name> '<json>'` | Add job | Task ID (UUID) |
| `jq-status <id>` | Get task detail | JSON blob |
| `jq-list [--status=X]` | List tasks | Table |
| `jq-retry <id>` | Retry failed task | Confirmation |
| `jq-cancel <id>` | Cancel task | Confirmation |

### Step 4: Tests + README

- `test/queue.test.ts` — lifecycle test: enqueue → process → complete/fail → retry
- `README.md` — installation (Redis prereq, npm install, env setup), usage, OpenClaw integration (ClawHub install, GitHub URL install, manual install)

## Verification

1. `npm run build` — compiles without errors
2. Start Redis, run `npm start` — worker connects
3. `npx jq-enqueue test '{"foo":"bar"}'` — returns a task ID
4. `npx jq-status <id>` — shows task detail
5. `npx jq-list` — shows task table
6. `npm test` — passes

## Deferred (Post-MVP)

All of the following are out of scope for this PR:

- **Dashboard UI** — web-based task viewer
- **REST API + WebSocket layer** — real-time updates
- **Embedded Redis auto-start** — user provides Redis for now
- **Advanced stall detection** — rely on Bull MQ built-in
- **Webhook/notification support**
- **Task retention auto-pruning**
- **ClawHub publishing** — manual/GitHub install first
- **SQLite alternative backend**
