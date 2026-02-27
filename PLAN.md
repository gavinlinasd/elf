# OpenClaw Job Queue Skill — Execution Plan

## Project Structure

```
openclaw-job-queue/
├── package.json
├── tsconfig.json
├── SKILL.md                    # OpenClaw skill manifest
├── README.md
├── .env.example
├── docker-compose.yml          # Optional: Redis for dev
│
├── src/
│   ├── index.ts                # Skill entry point — registers hooks + starts services
│   ├── config.ts               # Env-based configuration (ports, Redis URL, retries, etc.)
│   │
│   ├── queue/
│   │   ├── client.ts           # Bull MQ queue + worker setup
│   │   ├── processor.ts        # Task processor — executes OpenClaw task payloads
│   │   ├── stall-monitor.ts    # Heartbeat-based stall detection
│   │   └── types.ts            # Task data model, status enums
│   │
│   ├── tools/
│   │   ├── enqueue-task.ts     # enqueue_task tool handler
│   │   ├── get-task-status.ts  # get_task_status tool handler
│   │   ├── list-tasks.ts       # list_tasks tool handler
│   │   ├── retry-task.ts       # retry_task tool handler
│   │   └── cancel-task.ts      # cancel_task tool handler
│   │
│   ├── api/
│   │   ├── server.ts           # Express/Fastify server for dashboard API
│   │   ├── routes.ts           # REST endpoints (GET /tasks, GET /tasks/:id, GET /stats)
│   │   └── ws.ts               # WebSocket handler for real-time updates
│   │
│   └── redis/
│       └── embedded.ts         # Auto-start bundled Redis if none available
│
├── dashboard/
│   ├── index.html              # Single HTML entry point
│   ├── style.css               # Minimal styling
│   └── app.js                  # Vanilla JS — task list, filters, stats bar, WS connection
│
└── test/
    ├── queue.test.ts           # Queue lifecycle tests
    ├── tools.test.ts           # Tool handler unit tests
    └── api.test.ts             # API endpoint tests
```

---

## Execution Steps

### Step 1: Project Scaffolding
- Initialize `package.json` with name, version, scripts
- Set up TypeScript config (`tsconfig.json`)
- Install core dependencies: `bullmq`, `ioredis`, `express`, `ws`, `uuid`
- Install dev dependencies: `typescript`, `tsx`, `vitest`
- Create `.env.example` with all configurable env vars
- Create `SKILL.md` — OpenClaw skill manifest describing capabilities and tools

### Step 2: Configuration & Data Model
- `src/config.ts` — Load env vars with sensible defaults (port 7700, Redis localhost:6379, 3 retries, 30s heartbeat, 7-day retention)
- `src/queue/types.ts` — Define `Task` interface, `TaskStatus` enum, priority types

### Step 3: Queue Engine (Core)
- `src/queue/client.ts` — Initialize Bull MQ queue and worker; wire up event listeners for state transitions (queued → running → completed/failed/stalled)
- `src/queue/processor.ts` — Task processor function that executes payloads; reports progress; handles errors
- `src/queue/stall-monitor.ts` — Heartbeat checker; marks jobs as stalled after configurable interval
- `src/redis/embedded.ts` — Attempt connection to configured Redis; if unavailable, spawn a bundled `redis-server` child process (or warn user to install)

### Step 4: Skill Tool Handlers
- `src/tools/enqueue-task.ts` — Validate input, add job to Bull MQ with priority, return task ID
- `src/tools/get-task-status.ts` — Fetch job by ID, return current state + timestamps + error info
- `src/tools/list-tasks.ts` — Query jobs by status filter, return paginated list
- `src/tools/retry-task.ts` — Move failed job back to queue, reset attempt count
- `src/tools/cancel-task.ts` — Remove queued job or signal abort to running job

### Step 5: Dashboard API
- `src/api/server.ts` — Express server on configurable port; serves static dashboard files + API routes
- `src/api/routes.ts` — REST endpoints:
  - `GET /api/tasks` — list with filtering/pagination
  - `GET /api/tasks/:id` — single task detail
  - `GET /api/stats` — aggregate stats (total today, success rate, avg duration, active count)
- `src/api/ws.ts` — WebSocket endpoint at `/ws`; broadcasts task state changes in real time

### Step 6: Dashboard UI
- `dashboard/index.html` — Single-page layout: stats bar at top, filterable task table, task detail panel
- `dashboard/style.css` — Clean, minimal dark theme; status color coding (green/red/yellow/blue/gray)
- `dashboard/app.js` — Vanilla JS:
  - Fetch tasks from API on load
  - Connect WebSocket for live updates
  - Filter buttons (all / queued / running / completed / failed / stalled)
  - Click-to-expand task detail (payload, timestamps, duration, error log)
  - Stats bar auto-updates

### Step 7: Entry Point & Wiring
- `src/index.ts` — Orchestrates startup:
  1. Load config
  2. Ensure Redis connection (auto-start if needed)
  3. Initialize Bull MQ queue + worker
  4. Start stall monitor
  5. Start dashboard API server
  6. Register skill tools with OpenClaw
  7. Log startup summary (dashboard URL, Redis status, queue ready)

### Step 8: Tests
- `test/queue.test.ts` — Enqueue, process, complete, fail, retry, cancel lifecycle
- `test/tools.test.ts` — Each tool handler with mocked queue
- `test/api.test.ts` — API routes return correct data, filters work, stats aggregate correctly

### Step 9: Polish & Docs
- `README.md` — Installation, quick start, configuration reference, architecture diagram
- `docker-compose.yml` — Optional Redis for dev environments
- npm scripts: `start`, `dev`, `test`, `build`

---

## Dependencies

**Runtime:**
- `bullmq` — Job queue on Redis
- `ioredis` — Redis client
- `express` — Dashboard API server
- `ws` — WebSocket for real-time updates
- `uuid` — Task ID generation

**Dev:**
- `typescript`
- `tsx` — Dev runner
- `vitest` — Testing
- `@types/express`, `@types/ws`

---

## Order of Operations

```
Step 1 (scaffold) → Step 2 (config/types) → Step 3 (queue core) → Step 4 (tools)
                                                                        ↓
                                              Step 7 (wiring) ← Step 5 (API) → Step 6 (UI)
                                                     ↓
                                              Step 8 (tests) → Step 9 (docs)
```

Steps 5 and 6 can be done in parallel. Everything else is sequential.

---

## What This Plan Does NOT Include (Phase 2+)
- Notification/webhook layer
- Desktop notifications
- CLI-only headless mode
- Skill registry publishing
- Task retention auto-pruning cron
- Embeddable gateway UI

These are explicitly deferred to Phase 2/3 per the PRD.
