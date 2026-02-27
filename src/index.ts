import { Job } from "bullmq";
import { createWorker } from "./queue.js";
import { TaskData } from "./types.js";

console.log("[jq] Starting job queue worker...");

const worker = createWorker(async (job: Job<TaskData>) => {
  console.log(`[jq] processing: ${job.id} (${job.data.name})`);
  // Default processor: just returns the payload as-is.
  // Custom processors can be registered by importing createWorker directly.
  return job.data.payload;
});

worker.on("ready", () => {
  console.log("[jq] Worker ready. Waiting for jobs...");
});

process.on("SIGINT", async () => {
  console.log("[jq] Shutting down...");
  await worker.close();
  process.exit(0);
});
