// Optional background worker — not the primary path.
// The agent-as-executor model uses CLI commands directly.
// This worker is kept for future automated/scheduled task processing.

import { Worker, Job } from "bullmq";
import { config } from "./config.js";
import { TaskData } from "./types.js";

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
  };
}

console.log("[elf] Starting background worker...");

const worker = new Worker<TaskData>(
  config.queueName,
  async (job: Job<TaskData>) => {
    console.log(`[elf] processing: ${job.id} (${job.data.name})`);
    return job.data.payload;
  },
  {
    connection: {
      ...parseRedisUrl(config.redisUrl),
      maxRetriesPerRequest: null,
      connectTimeout: config.connectionTimeout,
    },
    concurrency: 1,
  }
);

worker.on("ready", () => {
  console.log("[elf] Worker ready. Waiting for jobs...");
});

worker.on("completed", (job) => {
  console.log(`[elf] completed: ${job.id} (${job.data.name})`);
});

worker.on("failed", (job, err) => {
  console.log(`[elf] failed: ${job?.id} (${job?.data.name}) — ${err.message}`);
});

process.on("SIGINT", async () => {
  console.log("[elf] Shutting down...");
  await worker.close();
  process.exit(0);
});
