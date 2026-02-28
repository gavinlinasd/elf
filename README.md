# elf

OpenClaw skill for agent-driven task coordination. Create, claim, execute, and report tasks via a Redis-backed queue.

## How It Works

The agent is the executor. The queue is a coordination layer, not an autonomous processor.

1. Agent creates a task → `elf-do-this`
2. Agent claims the task → `elf-on-it`
3. Agent does the work (shell commands, file I/O, APIs — whatever it takes)
4. Agent reports the outcome → `elf-done` or `elf-borked`

The queue provides: persistence across sessions, visibility into what's pending/running/done, and coordination between multiple agents sharing a workspace.

## Prerequisites

- Node.js 18+
- Redis running locally (or accessible via URL)

```bash
# macOS
brew install redis && brew services start redis
# or Docker
docker run -d -p 6379:6379 redis
```

## Setup

```bash
npm install
npm run build
```

Copy `.env.example` to `.env` and adjust if needed:

```
REDIS_URL=redis://localhost:6379
CONNECTION_TIMEOUT=5000
```

## CLI Commands

```bash
# Create a task
npx elf-do-this send-report '{"to":"alice@example.com"}' --priority=8

# Claim it
npx elf-on-it <task-id>

# Do the work... then report success
npx elf-done <task-id> '{"sent":true}'

# Or report failure
npx elf-borked <task-id> 'SMTP connection refused'

# Check a specific task
npx elf-is-it-done <task-id>

# List all tasks
npx elf-whats-left
npx elf-whats-left --status=queued --limit=10

# Cancel a task
npx elf-nevermind <task-id>

# Check queue health
npx elf-status
```

## Install as OpenClaw Skill

**Manual:**
```bash
cd ~/.openclaw/skills
git clone <repo-url> elf
cd elf && npm install && npm run build
```

## Troubleshooting

**"Cannot connect to Redis"** — Redis isn't running. Start it with `brew services start redis` or `docker run -d -p 6379:6379 redis`.

**"not claimed" error on elf-done/elf-borked** — You need to claim the task with `elf-on-it` before reporting an outcome.

**"cannot claim" error** — The task is already claimed by another agent, or it's already completed/failed. Check its status with `elf-is-it-done`.

## Tests

Requires a running Redis instance.

```bash
npm test
```

## License

MIT
