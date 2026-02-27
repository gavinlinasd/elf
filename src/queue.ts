import { Queue, Worker, Job } from "bullmq";
import { config } from "./config.js";
import { TaskData, TaskStatus, TaskInfo } from "./types.js";

// bullmq accepts a connection object with host/port or a url via its bundled ioredis.
// We parse the REDIS_URL into host/port to avoid importing ioredis separately.
function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
  };
}

const connection = { ...parseRedisUrl(config.redisUrl), maxRetriesPerRequest: null };

export const queue = new Queue<TaskData>(config.queueName, { connection });

export async function enqueueTask(
  name: string,
  payload: Record<string, unknown>,
  priority: number = 5
): Promise<string> {
  const job = await queue.add(
    name,
    { name, payload, priority },
    {
      priority,
      attempts: config.maxRetries + 1,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
  return job.id!;
}

export async function getTaskInfo(taskId: string): Promise<TaskInfo | null> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return null;
  return jobToTaskInfo(job);
}

export async function listTasks(
  status?: TaskStatus,
  limit: number = 20
): Promise<TaskInfo[]> {
  const stateMap: Record<string, string[]> = {
    [TaskStatus.Queued]: ["waiting", "prioritized", "delayed"],
    [TaskStatus.Running]: ["active"],
    [TaskStatus.Completed]: ["completed"],
    [TaskStatus.Failed]: ["failed"],
  };

  let jobs: Job<TaskData>[];
  if (status && stateMap[status]) {
    jobs = await queue.getJobs(stateMap[status] as any, 0, limit - 1);
  } else {
    jobs = await queue.getJobs(
      ["waiting", "prioritized", "delayed", "active", "completed", "failed"],
      0,
      limit - 1
    );
  }

  return Promise.all(jobs.map(jobToTaskInfo));
}

export async function retryTask(taskId: string): Promise<boolean> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return false;
  await job.retry();
  return true;
}

export async function cancelTask(taskId: string): Promise<boolean> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return false;
  const state = await job.getState();
  if (state === "active") {
    await job.moveToFailed(new Error("Cancelled by user"), "0");
  } else {
    await job.remove();
  }
  return true;
}

async function jobToTaskInfo(job: Job<TaskData>): Promise<TaskInfo> {
  const state = await job.getState();

  let status: TaskStatus;
  switch (state) {
    case "active":
      status = TaskStatus.Running;
      break;
    case "completed":
      status = TaskStatus.Completed;
      break;
    case "failed":
      status = TaskStatus.Failed;
      break;
    default:
      status = TaskStatus.Queued;
  }

  if (status === TaskStatus.Failed && job.failedReason === "Cancelled by user") {
    status = TaskStatus.Cancelled;
  }

  return {
    id: job.id!,
    name: job.data.name,
    status,
    payload: job.data.payload,
    priority: job.data.priority ?? 5,
    progress: typeof job.progress === "number" ? job.progress : 0,
    result: job.returnvalue ?? undefined,
    error: job.failedReason ?? undefined,
    attempts: job.attemptsMade,
    maxRetries: config.maxRetries,
    createdAt: job.timestamp,
    startedAt: job.processedOn ?? undefined,
    completedAt: job.finishedOn && status === TaskStatus.Completed ? job.finishedOn : undefined,
    failedAt: job.finishedOn && (status === TaskStatus.Failed || status === TaskStatus.Cancelled) ? job.finishedOn : undefined,
  };
}

export function createWorker(
  processor: (job: Job<TaskData>) => Promise<unknown>
): Worker<TaskData> {
  const worker = new Worker<TaskData>(config.queueName, processor, {
    connection: { ...parseRedisUrl(config.redisUrl), maxRetriesPerRequest: null },
    concurrency: config.concurrency,
  });

  worker.on("completed", (job) => {
    console.log(`[jq] completed: ${job.id} (${job.data.name})`);
  });

  worker.on("failed", (job, err) => {
    console.log(`[jq] failed: ${job?.id} (${job?.data.name}) — ${err.message}`);
  });

  return worker;
}
