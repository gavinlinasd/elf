import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  queue,
  enqueueTask,
  getTaskInfo,
  listTasks,
  retryTask,
  cancelTask,
  createWorker,
} from "../src/queue.js";
import { TaskStatus } from "../src/types.js";

// These tests require a running Redis instance.
// Set REDIS_URL env var or use default localhost:6379.

describe("job queue lifecycle", () => {
  let worker: ReturnType<typeof createWorker>;

  beforeAll(async () => {
    // Drain any leftover jobs from previous runs
    await queue.obliterate({ force: true });

    // Create a simple worker that returns the payload
    worker = createWorker(async (job) => {
      if (job.data.name === "fail-me") {
        throw new Error("intentional failure");
      }
      return job.data.payload;
    });
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
  });

  it("enqueue returns a task id", async () => {
    const id = await enqueueTask("test-task", { foo: "bar" });
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("get task info returns correct data", async () => {
    const id = await enqueueTask("info-task", { key: "value" }, 8);
    const info = await getTaskInfo(id);
    expect(info).not.toBeNull();
    expect(info!.name).toBe("info-task");
    expect(info!.payload).toEqual({ key: "value" });
    expect(info!.priority).toBe(8);
    expect(info!.status).toBe(TaskStatus.Queued);
  });

  it("list tasks returns enqueued tasks", async () => {
    const tasks = await listTasks();
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("task completes after worker processes it", async () => {
    const id = await enqueueTask("complete-me", { data: 123 });

    // Wait for the worker to process
    await new Promise<void>((resolve) => {
      worker.on("completed", (job) => {
        if (job.id === id) resolve();
      });
    });

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Completed);
    expect(info!.result).toEqual({ data: 123 });
  });

  it("failed task can be retried", async () => {
    const id = await enqueueTask("fail-me", { data: "bad" });

    // Wait for failure (all attempts exhausted)
    await new Promise<void>((resolve) => {
      worker.on("failed", (job) => {
        if (job?.id === id) resolve();
      });
    });

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Failed);

    const ok = await retryTask(id);
    expect(ok).toBe(true);
  });

  it("cancel removes a queued task", async () => {
    // Pause worker so the job stays queued
    await worker.pause();
    const id = await enqueueTask("cancel-me", { data: "remove" });

    const ok = await cancelTask(id);
    expect(ok).toBe(true);

    const info = await getTaskInfo(id);
    // Job was removed, so it should be null
    expect(info).toBeNull();

    await worker.resume();
  });
});
