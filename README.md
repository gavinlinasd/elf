# openclaw-job-queue

OpenClaw skill for tracking async task execution with a local job queue backed by Bull MQ and Redis.

## Prerequisites

- Node.js 18+
- Redis running locally (or accessible via URL)

```bash
# Start Redis
brew install redis && brew services start redis
# or
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
MAX_RETRIES=3
CONCURRENCY=5
```

## Start the Worker

```bash
npm start
```

## CLI Commands

```bash
# Enqueue a task
npx jq-enqueue send-email '{"to":"alice@example.com","subject":"Report"}'

# Check task status
npx jq-status <task-id>

# List tasks
npx jq-list
npx jq-list --status=failed --limit=10

# Retry a failed task
npx jq-retry <task-id>

# Cancel a task
npx jq-cancel <task-id>
```

## Install as OpenClaw Skill

**ClawHub** (after publishing):
```bash
clawhub install job-queue
```

**GitHub URL** (paste into any OpenClaw chat):
> Install and use the skill at https://github.com/<user>/openclaw-job-queue

**Manual:**
```bash
cd ~/.openclaw/skills
git clone https://github.com/<user>/openclaw-job-queue job-queue
cd job-queue && npm install && npm run build
```

## Tests

Requires a running Redis instance.

```bash
npm test
```

## License

MIT
