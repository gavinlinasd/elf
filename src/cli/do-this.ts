#!/usr/bin/env node
import { enqueueTask } from "../queue.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: elf-do-this <task-name> '<json-payload>' [--priority=<1-10>]");
    process.exit(1);
  }

  const name = args[0];
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(args[1]);
  } catch {
    console.error("Error: payload must be valid JSON");
    process.exit(1);
  }

  let priority = 5;
  const priorityArg = args.find((a) => a.startsWith("--priority="));
  if (priorityArg) {
    priority = Math.max(1, Math.min(10, parseInt(priorityArg.split("=")[1], 10)));
  }

  const id = await enqueueTask(name, payload, priority);
  console.log(`enqueued ${id}`);
});
