#!/usr/bin/env node
import { retryTask } from "../queue.js";

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: jq-retry <task-id>");
    process.exit(1);
  }

  const ok = await retryTask(taskId);
  if (!ok) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`retried ${taskId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
