import { config } from "../config.js";
import { queue } from "../queue.js";

export async function withConnection(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (
      err?.code === "ECONNREFUSED" ||
      err?.code === "ETIMEDOUT" ||
      err?.code === "ENOTFOUND" ||
      err?.message?.includes("ECONNREFUSED") ||
      err?.message?.includes("connect ETIMEDOUT")
    ) {
      console.error(
        `Error: Cannot connect to Redis at ${config.redisUrl}. Is Redis running?`
      );
      process.exit(1);
    }
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    await queue.close().catch(() => {});
  }
}
