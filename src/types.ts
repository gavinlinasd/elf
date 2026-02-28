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
  claimedBy?: string;
  result?: unknown;
  error?: string;
}

export interface TaskInfo {
  id: string;
  name: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  priority: number;
  result?: unknown;
  error?: string;
  claimedBy?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
}
