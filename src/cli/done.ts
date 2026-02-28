#!/usr/bin/env node
import { completeTask } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error("Usage: elf-done <task-id> ['<result-json>']");
    process.exit(1);
  }

  const taskId = args[0];
  let result: unknown;
  if (args[1]) {
    try {
      result = JSON.parse(args[1]);
    } catch {
      console.error("Error: result must be valid JSON");
      process.exit(1);
    }
  }

  const info = await completeTask(taskId, result);
  if (!info) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`completed ${taskId}`);
});
