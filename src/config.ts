export const config = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  concurrency: parseInt(process.env.CONCURRENCY || "5", 10),
  queueName: "openclaw-jobs",
};
