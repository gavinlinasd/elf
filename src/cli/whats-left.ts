#!/usr/bin/env node
import { listTasks } from "../queue.js";
import { TaskStatus } from "../types.js";
import { withConnection } from "./util.js";

withConnection(async () => {
  const args = process.argv.slice(2);

  let status: TaskStatus | undefined;
  const statusArg = args.find((a) => a.startsWith("--status="));
  if (statusArg) {
    const val = statusArg.split("=")[1] as TaskStatus;
    if (!Object.values(TaskStatus).includes(val)) {
      console.error(
        `Error: invalid status. Use: ${Object.values(TaskStatus).join(", ")}`
      );
      process.exit(1);
    }
    status = val;
  }

  let limit = 20;
  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (limitArg) {
    limit = parseInt(limitArg.split("=")[1], 10);
  }

  const tasks = await listTasks(status, limit);

  if (tasks.length === 0) {
    console.log("No tasks found.");
    process.exit(0);
  }

  const header = "ID\tSTATUS\tNAME\tCLAIMED BY\tCREATED";
  console.log(header);
  console.log("-".repeat(80));
  for (const t of tasks) {
    const created = new Date(t.createdAt).toISOString();
    console.log(
      `${t.id}\t${t.status}\t${t.name}\t${t.claimedBy || "-"}\t${created}`
    );
  }
  console.log(`\n${tasks.length} task(s)`);
});
