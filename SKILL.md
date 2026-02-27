---
name: job-queue
description: Track and manage async task execution with a local job queue backed by Bull MQ and Redis.
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
    emoji: 📋
---

## Job Queue Skill

You have access to a local job queue for tracking async task execution. Jobs are persisted in Redis via Bull MQ and survive restarts.

### Available Commands

#### Enqueue a task
```
npx jq-enqueue <task-name> '<json-payload>' [--priority=<1-10>]
```
Creates a new job and returns its ID. Priority 1 = lowest, 10 = highest. Default: 5.

#### Check task status
```
npx jq-status <task-id>
```
Returns JSON with status, timestamps, progress, result, or error details.

#### List tasks
```
npx jq-list [--status=queued|running|completed|failed] [--limit=20]
```
Prints a table of tasks. Without `--status`, shows all. Default limit: 20.

#### Retry a failed task
```
npx jq-retry <task-id>
```
Re-enqueues a failed task for another attempt.

#### Cancel a task
```
npx jq-cancel <task-id>
```
Removes a queued task or signals a running task to stop.

### When to Use

- Before starting a long-running operation, enqueue it so progress is tracked
- After enqueuing, report the task ID to the user
- Periodically check status of running tasks when the user asks
- If a task fails, inspect the error and decide whether to retry

### Output Format

All commands print structured output. `jq-status` returns JSON. `jq-list` returns a formatted table. Other commands print a single confirmation line with the task ID.
