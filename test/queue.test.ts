import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  queue,
  enqueueTask,
  claimTask,
  completeTask,
  failTask,
  getTaskInfo,
  listTasks,
  cancelTask,
  getQueueCounts,
} from "../src/queue.js";
import { TaskStatus } from "../src/types.js";

// These tests require a running Redis instance.
// Set REDIS_URL env var or use default localhost:6379.

describe("elf task lifecycle", () => {
  beforeEach(async () => {
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
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
    await enqueueTask("list-task-1", { a: 1 });
    await enqueueTask("list-task-2", { b: 2 });
    const tasks = await listTasks();
    expect(tasks.length).toBe(2);
  });

  it("list tasks filters by status", async () => {
    await enqueueTask("queued-task", { x: 1 });
    const queued = await listTasks(TaskStatus.Queued);
    expect(queued.length).toBe(1);
    const running = await listTasks(TaskStatus.Running);
    expect(running.length).toBe(0);
  });

  it("claim sets status to running and stores claimedBy", async () => {
    const id = await enqueueTask("claim-me", { data: 1 });
    const info = await claimTask(id, "agent-007");
    expect(info).not.toBeNull();

    const updated = await getTaskInfo(id);
    expect(updated!.status).toBe(TaskStatus.Running);
    expect(updated!.claimedBy).toBe("agent-007");
  });

  it("cannot claim an already-claimed task", async () => {
    const id = await enqueueTask("double-claim", { data: 1 });
    await claimTask(id, "agent-1");

    await expect(claimTask(id, "agent-2")).rejects.toThrow("cannot claim");
  });

  it("cannot claim a completed task", async () => {
    const id = await enqueueTask("done-task", { data: 1 });
    await claimTask(id);
    await completeTask(id, { result: "ok" });

    await expect(claimTask(id)).rejects.toThrow("cannot claim");
  });

  it("complete stores result and sets status", async () => {
    const id = await enqueueTask("finish-me", { data: 1 });
    await claimTask(id);
    await completeTask(id, { output: "success" });

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Completed);
    expect(info!.result).toEqual({ output: "success" });
  });

  it("complete without result works", async () => {
    const id = await enqueueTask("finish-no-result", { data: 1 });
    await claimTask(id);
    await completeTask(id);

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Completed);
  });

  it("cannot complete a task that is not claimed", async () => {
    const id = await enqueueTask("not-claimed", { data: 1 });
    await expect(completeTask(id)).rejects.toThrow("not claimed");
  });

  it("borked stores error and sets status to failed", async () => {
    const id = await enqueueTask("break-me", { data: 1 });
    await claimTask(id);
    await failTask(id, "disk full");

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Failed);
    expect(info!.error).toBe("disk full");
  });

  it("cannot fail a task that is not claimed", async () => {
    const id = await enqueueTask("not-claimed-fail", { data: 1 });
    await expect(failTask(id, "oops")).rejects.toThrow("not claimed");
  });

  it("cancel removes a queued task", async () => {
    const id = await enqueueTask("cancel-me", { data: "remove" });
    const ok = await cancelTask(id);
    expect(ok).toBe(true);

    const info = await getTaskInfo(id);
    expect(info).toBeNull();
  });

  it("cancel a claimed/running task marks it cancelled", async () => {
    const id = await enqueueTask("cancel-running", { data: 1 });
    await claimTask(id);

    const ok = await cancelTask(id);
    expect(ok).toBe(true);

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Cancelled);
  });

  it("cannot cancel a completed task", async () => {
    const id = await enqueueTask("done-then-cancel", { data: 1 });
    await claimTask(id);
    await completeTask(id);

    await expect(cancelTask(id)).rejects.toThrow("already completed");
  });

  it("full lifecycle: create -> claim -> done", async () => {
    const id = await enqueueTask("full-cycle", { step: 1 });

    let info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Queued);

    await claimTask(id, "my-agent");
    info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Running);
    expect(info!.claimedBy).toBe("my-agent");

    await completeTask(id, { step: "done" });
    info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Completed);
    expect(info!.result).toEqual({ step: "done" });
  });

  it("full lifecycle: create -> claim -> borked", async () => {
    const id = await enqueueTask("fail-cycle", { step: 1 });
    await claimTask(id);
    await failTask(id, "something went wrong");

    const info = await getTaskInfo(id);
    expect(info!.status).toBe(TaskStatus.Failed);
    expect(info!.error).toBe("something went wrong");
  });

  it("getQueueCounts returns correct counts", async () => {
    await enqueueTask("count-1", { a: 1 });
    await enqueueTask("count-2", { b: 2 });
    const id3 = await enqueueTask("count-3", { c: 3 });
    await claimTask(id3);

    const counts = await getQueueCounts();
    expect(counts.queued).toBe(2);
    expect(counts.running).toBe(1);
  });
});
