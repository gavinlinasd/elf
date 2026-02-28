---
name: elf
description: Agent-driven task coordination — create, claim, execute, and report tasks via a Redis-backed queue.
version: 2.0.0
metadata:
  openclaw:
    requires:
      env:
        - REDIS_URL
      bins:
        - node
        - npx
    install:
      - kind: node
        path: .
      - kind: brew
        package: redis
    primaryEnv: REDIS_URL
    emoji: 🧝
---

## Elf — Task Coordination Skill

You have a task queue for coordinating work. Tasks are persisted in Redis and survive restarts.

**You are the executor.** Create tasks, claim them, do the work, then report the outcome. The queue tracks what's pending, who's working on what, and what's done.

### Workflow

1. Create a task: `npx elf-do-this <name> '<payload>'`
2. Claim it before starting work: `npx elf-on-it <id>`
3. Do the actual work (run commands, edit files, call APIs, etc.)
4. Report the outcome:
   - Success: `npx elf-done <id> '<result-json>'`
   - Failure: `npx elf-borked <id> '<error-message>'`

### Commands

#### Create a task
```
npx elf-do-this <task-name> '<json-payload>' [--priority=<1-10>]
```
Returns the task ID. Priority 1 = lowest, 10 = highest. Default: 5.

#### Claim a task
```
npx elf-on-it <task-id> [--agent=<agent-id>]
```
Marks the task as running. Prevents other agents from double-executing it.

#### Mark task complete
```
npx elf-done <task-id> ['<result-json>']
```
Records the result and marks the task as completed.

#### Mark task failed
```
npx elf-borked <task-id> '<error-message>'
```
Records what went wrong. Different from cancel — this means "I tried and it broke."

#### Check a task
```
npx elf-is-it-done <task-id>
```
Returns full task detail as JSON (status, payload, result, error, timestamps).

#### List tasks
```
npx elf-whats-left [--status=queued|running|completed|failed|cancelled] [--limit=20]
```
Prints a table of tasks. Without `--status`, shows all.

#### Cancel a task
```
npx elf-nevermind <task-id>
```
Removes a queued task or marks a running task as cancelled. Means "don't bother."

#### Queue health
```
npx elf-status
```
Checks Redis connectivity and shows task counts by status.

### When to Use

- Before starting a multi-step operation, create a task so progress is tracked
- Always claim before doing work — this prevents duplicate execution in multi-agent setups
- After finishing, report with `elf-done` or `elf-borked` — don't leave tasks hanging
- If a task failed, read the error with `elf-is-it-done`, understand why, fix the root cause, and create a new task
- Check `elf-whats-left --status=queued` to find pending work
- Run `elf-status` to verify Redis is reachable

### Output Format

`elf-is-it-done` returns JSON. `elf-whats-left` returns a formatted table. `elf-status` returns queue statistics. All other commands print a single confirmation line with the task ID.
