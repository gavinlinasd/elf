#!/usr/bin/env node
import { cancelTask } from "../queue.js";

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: jq-cancel <task-id>");
    process.exit(1);
  }

  const ok = await cancelTask(taskId);
  if (!ok) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`cancelled ${taskId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
