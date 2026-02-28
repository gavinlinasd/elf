import { Queue, Job } from "bullmq";
import { config } from "./config.js";
import { TaskData, TaskStatus, TaskInfo } from "./types.js";

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
  };
}

const connection = {
  ...parseRedisUrl(config.redisUrl),
  maxRetriesPerRequest: null,
  connectTimeout: config.connectionTimeout,
};

export const queue = new Queue<TaskData>(config.queueName, { connection });

export async function enqueueTask(
  name: string,
  payload: Record<string, unknown>,
  priority: number = 5
): Promise<string> {
  const job = await queue.add(
    name,
    { name, payload, priority },
    { priority }
  );
  return job.id!;
}

export async function claimTask(
  taskId: string,
  agentId?: string
): Promise<TaskInfo | null> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return null;

  const state = await job.getState();
  if (state !== "waiting" && state !== "prioritized" && state !== "delayed") {
    throw new Error(
      `cannot claim task ${taskId}: status is ${state}, expected queued`
    );
  }

  // Move to active by updating data, then move to completed-like state
  // BullMQ doesn't have a native "claim" — we move it to active via moveToFailed trick
  // Actually, we store the claim info in the job data and move it to active
  await job.updateData({
    ...job.data,
    claimedBy: agentId,
  });

  // Move the job to active state by promoting and marking as active
  await job.moveToFailed(new Error("__elf_claimed__"), "0");
  // Now the job is in "failed" state in BullMQ, but we track it as "running" via the marker

  return jobToTaskInfo(job);
}

export async function completeTask(
  taskId: string,
  result?: unknown
): Promise<TaskInfo | null> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return null;

  const state = await job.getState();
  const isClaimed =
    state === "failed" && job.failedReason === "__elf_claimed__";
  if (!isClaimed) {
    throw new Error(
      `cannot complete task ${taskId}: not claimed (status: ${state})`
    );
  }

  await job.updateData({
    ...job.data,
    result,
  });

  // Move from "claimed" (our fake failed) to real completed
  await job.retry("completed");
  // Update the return value
  await job.moveToCompleted(result, "0");

  return jobToTaskInfo(job);
}

export async function failTask(
  taskId: string,
  error: string
): Promise<TaskInfo | null> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return null;

  const state = await job.getState();
  const isClaimed =
    state === "failed" && job.failedReason === "__elf_claimed__";
  if (!isClaimed) {
    throw new Error(
      `cannot fail task ${taskId}: not claimed (status: ${state})`
    );
  }

  await job.updateData({
    ...job.data,
    error,
  });

  // Move from "claimed" to real failed with actual error
  await job.retry("failed");
  await job.moveToFailed(new Error(error), "0");

  return jobToTaskInfo(job);
}

export async function getTaskInfo(
  taskId: string
): Promise<TaskInfo | null> {
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
    [TaskStatus.Running]: ["failed"], // claimed tasks are in BullMQ "failed" with __elf_claimed__
    [TaskStatus.Completed]: ["completed"],
    [TaskStatus.Failed]: ["failed"],
    [TaskStatus.Cancelled]: ["failed"],
  };

  let jobs: Job<TaskData>[];
  if (status && stateMap[status]) {
    jobs = await queue.getJobs(stateMap[status] as any, 0, limit * 2);
  } else {
    jobs = await queue.getJobs(
      ["waiting", "prioritized", "delayed", "completed", "failed"],
      0,
      limit * 2
    );
  }

  const infos = await Promise.all(jobs.map(jobToTaskInfo));

  // Filter by requested status if specified
  const filtered = status
    ? infos.filter((t) => t.status === status)
    : infos;

  return filtered.slice(0, limit);
}

export async function cancelTask(
  taskId: string
): Promise<boolean> {
  const job = await Job.fromId<TaskData>(queue, taskId);
  if (!job) return false;
  const state = await job.getState();

  if (state === "completed") {
    throw new Error(`cannot cancel task ${taskId}: already completed`);
  }

  if (
    state === "failed" &&
    job.failedReason === "__elf_claimed__"
  ) {
    // Currently claimed/running — mark as cancelled
    await job.updateData({ ...job.data, error: "Cancelled" });
    await job.retry("failed");
    await job.moveToFailed(new Error("Cancelled"), "0");
    return true;
  }

  if (state === "failed") {
    // Already failed — just update the reason
    await job.retry("failed");
    await job.moveToFailed(new Error("Cancelled"), "0");
    return true;
  }

  // Queued — remove it
  await job.remove();
  return true;
}

export async function getQueueCounts(): Promise<
  Record<string, number>
> {
  const counts = await queue.getJobCounts(
    "waiting",
    "prioritized",
    "delayed",
    "active",
    "completed",
    "failed"
  );
  // Map BullMQ states to our statuses by scanning failed jobs
  const failedJobs = await queue.getJobs(["failed"], 0, 500);

  let claimed = 0;
  let cancelled = 0;
  let realFailed = 0;
  for (const job of failedJobs) {
    if (job.failedReason === "__elf_claimed__") {
      claimed++;
    } else if (job.failedReason === "Cancelled") {
      cancelled++;
    } else {
      realFailed++;
    }
  }

  return {
    queued: (counts.waiting || 0) + (counts.prioritized || 0) + (counts.delayed || 0),
    running: claimed,
    completed: counts.completed || 0,
    failed: realFailed,
    cancelled,
  };
}

async function jobToTaskInfo(job: Job<TaskData>): Promise<TaskInfo> {
  const state = await job.getState();

  let status: TaskStatus;
  if (state === "completed") {
    status = TaskStatus.Completed;
  } else if (state === "failed") {
    if (job.failedReason === "__elf_claimed__") {
      status = TaskStatus.Running;
    } else if (job.failedReason === "Cancelled") {
      status = TaskStatus.Cancelled;
    } else {
      status = TaskStatus.Failed;
    }
  } else {
    status = TaskStatus.Queued;
  }

  return {
    id: job.id!,
    name: job.data.name,
    status,
    payload: job.data.payload,
    priority: job.data.priority ?? 5,
    result: job.data.result ?? job.returnvalue ?? undefined,
    error:
      status === TaskStatus.Failed || status === TaskStatus.Cancelled
        ? job.data.error ?? job.failedReason ?? undefined
        : undefined,
    claimedBy: job.data.claimedBy,
    createdAt: job.timestamp,
    startedAt: job.processedOn ?? undefined,
    completedAt:
      job.finishedOn && status === TaskStatus.Completed
        ? job.finishedOn
        : undefined,
    failedAt:
      job.finishedOn &&
      (status === TaskStatus.Failed || status === TaskStatus.Cancelled)
        ? job.finishedOn
        : undefined,
  };
}
