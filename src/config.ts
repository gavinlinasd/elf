export const config = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || "5000", 10),
  queueName: "elf-tasks",
};
