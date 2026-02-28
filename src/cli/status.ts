#!/usr/bin/env node
import { getQueueCounts, queue } from "../queue.js";
import { config } from "../config.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const counts = await getQueueCounts();
  const total =
    counts.queued +
    counts.running +
    counts.completed +
    counts.failed +
    counts.cancelled;

  console.log(`elf-status — connected to ${config.redisUrl}`);
  console.log(`queue: ${config.queueName}`);
  console.log("");
  console.log(`  queued:    ${counts.queued}`);
  console.log(`  running:   ${counts.running}`);
  console.log(`  completed: ${counts.completed}`);
  console.log(`  failed:    ${counts.failed}`);
  console.log(`  cancelled: ${counts.cancelled}`);
  console.log(`  total:     ${total}`);
});
