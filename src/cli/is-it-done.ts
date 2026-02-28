#!/usr/bin/env node
import { getTaskInfo } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: elf-is-it-done <task-id>");
    process.exit(1);
  }

  const info = await getTaskInfo(taskId);
  if (!info) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(JSON.stringify(info, null, 2));
});
