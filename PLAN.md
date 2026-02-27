# OpenClaw Job Queue Skill — Execution Plan

## How OpenClaw Skills Work (Context)

OpenClaw skills are **folders with a `SKILL.md` file**. That's the core contract.

- **Tools** = "organs" — they determine what OpenClaw *can* do (shell, HTTP, browser, etc.)
- **Skills** = "textbooks" — they teach OpenClaw *how* to combine tools for a specific job

A skill folder contains:
- `SKILL.md` — YAML frontmatter (metadata) + markdown body (instructions for the agent)
- Supporting files — scripts, templates, configs, whatever the skill needs

Skills are distributed via **ClawHub** (`clawhub install <slug>`) or by pointing the agent at a GitHub repo URL in chat. The Gateway loads skill instructions into the agent's context when activated.

**Key insight**: OpenClaw skills don't register custom "tool endpoints." They teach the agent to use *existing* tools (shell commands, HTTP requests, file operations) in a specific way. Our job queue skill will use shell scripts that the agent calls via the `shell` tool.

---

## Absolute Minimum MVP

The question: what's the least amount of code that delivers real value?

**Cut list** (defer to later):
- ~~Dashboard UI~~ — CLI output is enough for MVP
- ~~WebSocket real-time updates~~ — polling/CLI is fine
- ~~Express API server~~ — not needed without dashboard
- ~~Stall monitor~~ — Bull MQ has built-in stall detection
- ~~Embedded Redis auto-start~~ — user provides Redis (or we use SQLite)

**What stays**:
1. SKILL.md that teaches the agent to use queue tools
2. CLI scripts the agent can invoke via shell
3. Bull MQ + Redis backend (or simpler: SQLite-based queue for zero-dep)
4. Core operations: enqueue, status, list, retry, cancel

### MVP Decision: Redis vs SQLite

**Option A — Bull MQ + Redis** (original plan)
- Pro: Battle-tested, real job queue semantics, concurrent workers
- Con: Requires Redis running, heavier dependency

**Option B — SQLite queue** (simpler)
- Pro: Zero external dependencies, single file, works everywhere
- Con: No real worker process, polling-based, less battle-tested

**Recommendation**: Go with **Bull MQ + Redis** but make Redis a documented prerequisite (most OpenClaw users already have it or can `brew install redis` / `apt install redis`). This is the OpenClaw ecosystem norm — skills commonly require external services.

---

## MVP Project Structure

```
openclaw-job-queue/
├── SKILL.md                    # OpenClaw skill manifest + agent instructions
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
├── src/
│   ├── index.ts                # Entry point — starts queue worker
│   ├── config.ts               # Env-based configuration
│   ├── queue.ts                # Bull MQ queue + worker setup
│   ├── types.ts                # Task data model
│   │
│   └── cli/                    # CLI commands the agent invokes via shell
│       ├── enqueue.ts          # npx jq-enqueue <name> <payload>
│       ├── status.ts           # npx jq-status <task-id>
│       ├── list.ts             # npx jq-list [--status=failed]
│       ├── retry.ts            # npx jq-retry <task-id>
│       └── cancel.ts           # npx jq-cancel <task-id>
│
└── test/
    └── queue.test.ts           # Core lifecycle tests
```

That's **~10 files**. No dashboard, no API server, no WebSocket layer.

---

## MVP Execution Steps (4 steps, not 9)

### Step 1: Scaffold + SKILL.md
- `package.json` with `bin` entries mapping CLI commands
- `tsconfig.json`
- `SKILL.md` with proper OpenClaw frontmatter + agent instructions
- `.env.example`

The SKILL.md is the most important file. It tells the agent:
- What this skill does
- What CLI commands are available
- When and how to use each command
- How to interpret output

Example SKILL.md structure:
```yaml
---
name: job-queue
description: Track and manage async task execution with a local job queue.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env:
        - REDIS_URL
      bins:
        - node
        - npx
    primaryEnv: REDIS_URL
---
```

Followed by markdown instructions the agent reads at runtime.

### Step 2: Queue Engine + Types
- `src/types.ts` — Task interface, status enum
- `src/config.ts` — Load REDIS_URL, MAX_RETRIES, etc.
- `src/queue.ts` — Bull MQ queue, worker, processor, event handlers

### Step 3: CLI Commands
- 5 CLI scripts, each a standalone executable:
  - `jq-enqueue` — adds job, prints task ID
  - `jq-status` — prints task detail as JSON
  - `jq-list` — prints task table, supports `--status` filter
  - `jq-retry` — retries a failed task
  - `jq-cancel` — cancels a queued/running task
- Register as `bin` entries in `package.json` so they work via `npx`

### Step 4: Tests + README
- Queue lifecycle test (enqueue → process → complete/fail → retry)
- README with installation and usage instructions

---

## Integration with OpenClaw

### How a User Installs This Skill

**Option 1 — ClawHub (after publishing)**
```bash
npm i -g clawhub          # one-time: install ClawHub CLI
clawhub install job-queue  # installs skill into OpenClaw workspace
```

**Option 2 — GitHub URL (works immediately, no publishing needed)**
Paste the GitHub repo URL into any OpenClaw chat channel:
> "Install and use the skill at https://github.com/<user>/openclaw-job-queue"

The agent will clone the repo into its skills directory and read the SKILL.md.

**Option 3 — Manual install**
```bash
cd ~/.openclaw/skills      # or wherever your OpenClaw skills directory is
git clone https://github.com/<user>/openclaw-job-queue job-queue
cd job-queue && npm install
```

### How OpenClaw Uses the Skill at Runtime

1. User sends a message to OpenClaw (via WhatsApp, Slack, etc.)
2. Gateway routes message to an agent session
3. Agent's context includes the SKILL.md instructions from all active skills
4. When the agent decides to track a task, it follows the SKILL.md instructions
5. The agent calls the CLI tools via OpenClaw's `shell` tool:
   ```
   npx jq-enqueue "send-email" '{"to":"alice@example.com","subject":"Report"}'
   ```
6. The CLI prints structured output the agent can parse and relay to the user

### Prerequisites for the User

```bash
# 1. Redis must be running
brew install redis && brew services start redis
# or: docker run -d -p 6379:6379 redis

# 2. Set REDIS_URL in OpenClaw environment
# In your OpenClaw .env or workspace config:
REDIS_URL=redis://localhost:6379

# 3. Start the queue worker (runs alongside OpenClaw)
cd ~/.openclaw/skills/job-queue
npm start
```

### What the Agent Sees (SKILL.md body)

The markdown body of SKILL.md will contain instructions like:

```markdown
## Job Queue Skill

You have access to a local job queue for tracking async task execution.

### Available Commands

#### Enqueue a task
`npx jq-enqueue <task-name> '<json-payload>' [--priority=<0-10>]`
Returns: task ID (UUID)

#### Check task status
`npx jq-status <task-id>`
Returns: JSON with status, timestamps, error info

#### List tasks
`npx jq-list [--status=queued|running|completed|failed] [--limit=20]`
Returns: table of tasks

#### Retry a failed task
`npx jq-retry <task-id>`

#### Cancel a task
`npx jq-cancel <task-id>`

### When to Use
- Before starting a long-running operation, enqueue it
- After enqueuing, report the task ID to the user
- Periodically check status of running tasks
- If a task fails, check the error and decide whether to retry
```

---

## Publishing to ClawHub (Post-MVP)

```bash
npm i -g clawhub
clawhub login
clawhub publish .    # publishes from skill directory
```

This makes it available via `clawhub install job-queue` for all OpenClaw users.

---

## Order of Operations

```
Step 1 (SKILL.md + scaffold)  →  Step 2 (queue engine)  →  Step 3 (CLI commands)  →  Step 4 (tests + docs)
```

Strictly sequential. Estimated ~10 files total.

---

## What's Deferred (Phase 2+)

- Dashboard UI (web-based task viewer)
- REST API + WebSocket layer
- Embedded Redis auto-start
- Stall detection beyond Bull MQ built-in
- Webhook/notification support
- Task retention auto-pruning
- ClawHub publishing
- CLI-only headless mode
