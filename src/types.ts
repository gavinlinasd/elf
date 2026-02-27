export enum TaskStatus {
  Queued = "queued",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export interface TaskData {
  name: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export interface TaskInfo {
  id: string;
  name: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  priority: number;
  progress: number;
  result?: unknown;
  error?: string;
  attempts: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
}
