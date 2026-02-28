#!/usr/bin/env node
import { failTask } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: elf-borked <task-id> '<error-message>'");
    process.exit(1);
  }

  const taskId = args[0];
  const error = args[1];

  const info = await failTask(taskId, error);
  if (!info) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`failed ${taskId}`);
});
