#!/usr/bin/env node
import { claimTask } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error("Usage: elf-on-it <task-id> [--agent=<agent-id>]");
    process.exit(1);
  }

  const taskId = args[0];
  let agentId: string | undefined;
  const agentArg = args.find((a) => a.startsWith("--agent="));
  if (agentArg) {
    agentId = agentArg.split("=")[1];
  }

  const info = await claimTask(taskId, agentId);
  if (!info) {
    console.error(`Error: task ${taskId} not found`);
    process.exit(1);
  }

  console.log(`claimed ${taskId}`);
});
