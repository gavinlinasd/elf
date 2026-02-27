#!/usr/bin/env node
import { getTaskInfo } from "../queue.js";

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: jq-status <task-id>");
    process.exit(1);
  }

  const info = await getTaskInfo(taskId);
  if (!info) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
