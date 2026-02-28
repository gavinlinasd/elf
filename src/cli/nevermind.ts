#!/usr/bin/env node
import { cancelTask } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: elf-nevermind <task-id>");
    process.exit(1);
  }

  const ok = await cancelTask(taskId);
  if (!ok) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`cancelled ${taskId}`);
});
